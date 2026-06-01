using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TM.Web.Application.Dtos.Recall;
using TM.Web.Application.Security;
using TM.Web.Application.Services;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Recall;

public class ChapterRecallService : IChapterRecallService
{
    private static readonly Regex TokenRegex = new(
        @"[\p{IsCJKUnifiedIdeographs}]+|[\p{L}\p{N}]+",
        RegexOptions.Compiled);

    private readonly AppDbContext _db;
    private readonly IKeyProtector _protector;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<ChapterRecallService> _logger;

    public ChapterRecallService(
        AppDbContext db,
        IKeyProtector protector,
        IHttpClientFactory httpClientFactory,
        ILogger<ChapterRecallService> logger)
    {
        _db = db;
        _protector = protector;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<ChapterRecallResponseDto?> RecallAsync(
        string chapterId,
        string? query,
        int topK,
        CancellationToken ct = default)
    {
        var sourceChapter = await _db.Chapters
            .AsNoTracking()
            .Where(x => x.Id == chapterId)
            .Select(x => new ChapterStub(
                x.Id,
                x.ProjectId,
                x.VolumeId,
                x.ChapterNumber,
                x.Title,
                x.Summary))
            .FirstOrDefaultAsync(ct);

        if (sourceChapter == null)
        {
            return null;
        }

        var safeTopK = Math.Clamp(topK <= 0 ? 5 : topK, 1, 20);

        var sourceKeywordRows = await _db.KeywordChapterIndices
            .AsNoTracking()
            .Where(x => x.ProjectId == sourceChapter.ProjectId && x.ChapterId == chapterId)
            .OrderByDescending(x => x.OccurrenceCount)
            .ThenBy(x => x.Keyword)
            .Select(x => new KeywordHit(x.Keyword, x.OccurrenceCount))
            .ToListAsync(ct);

        var sourceKeywordCounts = sourceKeywordRows
            .GroupBy(x => x.Keyword, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => g.Max(x => x.OccurrenceCount),
                StringComparer.OrdinalIgnoreCase);

        var hasExplicitQuery = !string.IsNullOrWhiteSpace(query);
        var queryText = hasExplicitQuery
            ? query!.Trim()
            : BuildDefaultQuery(sourceChapter, sourceKeywordRows);

        var queryTerms = ExtractTerms(queryText);
        if (queryTerms.Count == 0)
        {
            queryTerms = ExtractTerms(sourceChapter.Title);
        }

        var interestingKeywords = queryTerms
            .Concat(sourceKeywordCounts.Keys)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(48)
            .ToArray();

        var candidateChapters = await _db.Chapters
            .AsNoTracking()
            .Where(x => x.ProjectId == sourceChapter.ProjectId && x.Id != chapterId)
            .Select(x => new ChapterStub(
                x.Id,
                x.ProjectId,
                x.VolumeId,
                x.ChapterNumber,
                x.Title,
                x.Summary))
            .ToListAsync(ct);

        var candidateKeywordRows = interestingKeywords.Length == 0
            ? new List<CandidateKeywordRow>()
            : await _db.KeywordChapterIndices
                .AsNoTracking()
                .Where(x => x.ProjectId == sourceChapter.ProjectId
                    && x.ChapterId != chapterId
                    && interestingKeywords.Contains(x.Keyword))
                .Select(x => new CandidateKeywordRow(x.ChapterId, x.Keyword, x.OccurrenceCount))
                .ToListAsync(ct);

        var keywordRowsByChapter = candidateKeywordRows
            .GroupBy(x => x.ChapterId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => g.ToList(),
                StringComparer.OrdinalIgnoreCase);

        var embeddingScores = await TryBuildEmbeddingScoresAsync(queryText, candidateChapters, ct);

        var results = candidateChapters
            .Select(candidate => ScoreCandidate(
                candidate,
                queryText,
                hasExplicitQuery,
                queryTerms,
                sourceKeywordCounts,
                keywordRowsByChapter.GetValueOrDefault(candidate.Id) ?? new List<CandidateKeywordRow>(),
                embeddingScores.GetValueOrDefault(candidate.Id)))
            .Where(x => x != null)
            .Cast<ChapterRecallResultDto>()
            .OrderByDescending(x => x.Score)
            .ThenBy(x => x.ChapterNumber)
            .Take(safeTopK)
            .ToList();

        return new ChapterRecallResponseDto(
            sourceChapter.Id,
            queryText,
            hasExplicitQuery ? "explicit-query" : "chapter-context",
            safeTopK,
            results);
    }

    private async Task<Dictionary<string, double>> TryBuildEmbeddingScoresAsync(
        string queryText,
        IReadOnlyList<ChapterStub> candidates,
        CancellationToken ct)
    {
        try
        {
            var config = await ResolveEmbeddingConfigAsync(ct);
            if (config == null)
            {
                return new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
            }

            var inputs = new List<string> { queryText };
            inputs.AddRange(candidates.Select(x => BuildEmbeddingInput(x)));

            var vectors = await GetEmbeddingsAsync(config, inputs, ct);
            if (vectors.Count != inputs.Count)
            {
                return new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
            }

            var queryVector = vectors[0];
            var scores = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < candidates.Count; i++)
            {
                scores[candidates[i].Id] = CosineSimilarity(queryVector, vectors[i + 1]);
            }

            return scores;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Embeddings recall unavailable, falling back to keyword recall");
            return new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
        }
    }

    private async Task<EmbeddingConfig?> ResolveEmbeddingConfigAsync(CancellationToken ct)
    {
        var model = await _db.AiModels
            .AsNoTracking()
            .Where(x => x.IsEnabled &&
                        (x.Code.Contains("embedding", StringComparison.OrdinalIgnoreCase) ||
                         x.Name.Contains("embedding", StringComparison.OrdinalIgnoreCase)))
            .OrderBy(x => x.SortOrder)
            .FirstOrDefaultAsync(ct);

        if (model == null)
        {
            return null;
        }

        var provider = await _db.AiProviders.AsNoTracking().FirstOrDefaultAsync(x => x.Id == model.ProviderId, ct);
        if (provider == null || string.IsNullOrWhiteSpace(provider.DefaultEndpoint))
        {
            return null;
        }

        var key = await _db.AiApiKeys
            .Where(x => x.ProviderId == provider.Id && x.IsEnabled)
            .OrderBy(x => x.RotationOrder)
            .ThenByDescending(x => x.LastUsedAt)
            .FirstOrDefaultAsync(ct);

        if (key == null)
        {
            return null;
        }

        var plainKey = _protector.Decrypt(key.EncryptedKey, key.Iv);
        return new EmbeddingConfig(provider.DefaultEndpoint!, model.Code, plainKey);
    }

    private async Task<IReadOnlyList<float[]>> GetEmbeddingsAsync(
        EmbeddingConfig config,
        IReadOnlyList<string> inputs,
        CancellationToken ct)
    {
        var client = _httpClientFactory.CreateClient(nameof(ChapterRecallService));
        using var request = new HttpRequestMessage(HttpMethod.Post, NormalizeEmbeddingsEndpoint(config.Endpoint));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", config.ApiKey);

        var payload = JsonSerializer.Serialize(new
        {
            model = config.ModelCode,
            input = inputs
        });
        request.Content = new StringContent(payload, Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        if (!document.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<float[]>();
        }

        var vectors = new List<float[]>();
        foreach (var item in data.EnumerateArray())
        {
            if (!item.TryGetProperty("embedding", out var embedding) || embedding.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            var values = embedding.EnumerateArray().Select(x => x.GetSingle()).ToArray();
            vectors.Add(values);
        }

        return vectors;
    }

    private static ChapterRecallResultDto? ScoreCandidate(
        ChapterStub candidate,
        string queryText,
        bool hasExplicitQuery,
        IReadOnlyCollection<string> queryTerms,
        IReadOnlyDictionary<string, int> sourceKeywordCounts,
        IReadOnlyCollection<CandidateKeywordRow> candidateKeywordRows,
        double embeddingSimilarity)
    {
        var titleHits = queryTerms.Sum(term => CountOccurrences(candidate.Title, term));
        var summaryHits = queryTerms.Sum(term => CountOccurrences(candidate.Summary, term));
        var fullPhraseHit = hasExplicitQuery && ContainsIgnoreCase(candidate.Title + "\n" + candidate.Summary, queryText) ? 1 : 0;

        var queryKeywordRows = candidateKeywordRows
            .Where(x => queryTerms.Contains(x.Keyword, StringComparer.OrdinalIgnoreCase))
            .ToList();

        var sharedKeywordRows = candidateKeywordRows
            .Where(x => sourceKeywordCounts.ContainsKey(x.Keyword))
            .ToList();

        var queryKeywordScore = queryKeywordRows.Sum(x => 3d + Math.Min(x.OccurrenceCount, 5) * 0.8d);
        var sharedKeywordScore = sharedKeywordRows.Sum(x =>
        {
            var sourceWeight = sourceKeywordCounts.GetValueOrDefault(x.Keyword);
            return 1.5d + Math.Min(sourceWeight + x.OccurrenceCount, 8) * 0.35d;
        });

        var embeddingScore = embeddingSimilarity > 0 ? embeddingSimilarity * 20d : 0d;

        var score =
            titleHits * 4d +
            summaryHits * 2d +
            fullPhraseHit * 6d +
            queryKeywordScore +
            sharedKeywordScore +
            embeddingScore;

        if (score <= 0)
        {
            return null;
        }

        var matchedKeywords = queryKeywordRows
            .Concat(sharedKeywordRows)
            .Select(x => x.Keyword)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(8)
            .ToArray();

        var reasonParts = new List<string>();
        if (matchedKeywords.Length > 0)
        {
            reasonParts.Add($"关键词命中：{string.Join("、", matchedKeywords)}");
        }

        if (titleHits > 0 || summaryHits > 0)
        {
            reasonParts.Add($"标题/摘要命中：{titleHits + summaryHits}");
        }

        var sharedKeywordCount = sharedKeywordRows
            .Select(x => x.Keyword)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count();

        if (sharedKeywordCount > 0)
        {
            reasonParts.Add($"共享索引关键词：{sharedKeywordCount}");
        }

        if (embeddingSimilarity > 0)
        {
            reasonParts.Add($"向量相似度：{embeddingSimilarity:F3}");
        }

        if (fullPhraseHit > 0)
        {
            reasonParts.Add("包含完整查询短语");
        }

        return new ChapterRecallResultDto(
            candidate.Id,
            candidate.Title,
            candidate.ChapterNumber,
            candidate.VolumeId,
            candidate.Summary,
            Math.Round(score, 2),
            matchedKeywords,
            reasonParts.Count == 0 ? "基于章节标题/摘要相似度匹配" : string.Join("；", reasonParts));
    }

    private static string BuildDefaultQuery(ChapterStub chapter, IReadOnlyList<KeywordHit> sourceKeywordRows)
    {
        var keywordText = string.Join(" ", sourceKeywordRows
            .OrderByDescending(x => x.OccurrenceCount)
            .Select(x => x.Keyword)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(6));

        var parts = new[]
        {
            chapter.Title.Trim(),
            TrimForQuery(chapter.Summary, 180),
            keywordText.Trim(),
        };

        return string.Join(" ", parts.Where(x => !string.IsNullOrWhiteSpace(x))).Trim();
    }

    private static string BuildEmbeddingInput(ChapterStub chapter)
        => $"{chapter.Title}\n{TrimForQuery(chapter.Summary, 800)}";

    private static List<string> ExtractTerms(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return new List<string>();
        }

        var terms = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (Match match in TokenRegex.Matches(text))
        {
            var value = match.Value.Trim();
            if (value.Length < 2)
            {
                continue;
            }

            if (value.Length > 20)
            {
                value = value[..20];
            }

            terms.Add(value);

            if (ContainsCjk(value))
            {
                foreach (var gram in BuildCjkNGrams(value, 2))
                {
                    terms.Add(gram);
                }
            }
        }

        return terms
            .OrderByDescending(x => x.Length)
            .ThenBy(x => x, StringComparer.OrdinalIgnoreCase)
            .Take(24)
            .ToList();
    }

    private static IEnumerable<string> BuildCjkNGrams(string value, int n)
    {
        if (value.Length <= n)
        {
            yield break;
        }

        for (var i = 0; i <= value.Length - n; i++)
        {
            yield return value.Substring(i, n);
        }
    }

    private static bool ContainsCjk(string value)
        => value.Any(ch => ch >= 0x4E00 && ch <= 0x9FFF);

    private static bool ContainsIgnoreCase(string source, string value)
        => source.Contains(value, StringComparison.OrdinalIgnoreCase);

    private static int CountOccurrences(string source, string term)
    {
        if (string.IsNullOrWhiteSpace(source) || string.IsNullOrWhiteSpace(term))
        {
            return 0;
        }

        var count = 0;
        var start = 0;
        while (start < source.Length)
        {
            var index = source.IndexOf(term, start, StringComparison.OrdinalIgnoreCase);
            if (index < 0)
            {
                break;
            }

            count++;
            start = index + term.Length;
        }

        return count;
    }

    private static string TrimForQuery(string text, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return string.Empty;
        }

        return text.Length <= maxLength ? text.Trim() : text[..maxLength].Trim();
    }

    private static double CosineSimilarity(float[] a, float[] b)
    {
        if (a.Length == 0 || b.Length == 0 || a.Length != b.Length)
        {
            return 0;
        }

        double dot = 0;
        double normA = 0;
        double normB = 0;
        for (var i = 0; i < a.Length; i++)
        {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        if (normA <= 0 || normB <= 0)
        {
            return 0;
        }

        return dot / (Math.Sqrt(normA) * Math.Sqrt(normB));
    }

    private static string NormalizeEmbeddingsEndpoint(string endpoint)
    {
        var trimmed = endpoint.Trim().TrimEnd('/');
        if (trimmed.EndsWith("/embeddings", StringComparison.OrdinalIgnoreCase))
        {
            return trimmed;
        }

        if (trimmed.EndsWith("/v1", StringComparison.OrdinalIgnoreCase))
        {
            return trimmed + "/embeddings";
        }

        return trimmed + "/v1/embeddings";
    }

    private sealed record ChapterStub(
        string Id,
        string ProjectId,
        string VolumeId,
        int ChapterNumber,
        string Title,
        string Summary);

    private sealed record KeywordHit(string Keyword, int OccurrenceCount);

    private sealed record CandidateKeywordRow(string ChapterId, string Keyword, int OccurrenceCount);

    private sealed record EmbeddingConfig(string Endpoint, string ModelCode, string ApiKey);
}
