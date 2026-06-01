using System.Globalization;
using System.Collections.Concurrent;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Dtos.Editor;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Core;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Editor;

public sealed class EditorService : IEditorService
{
    private const int MaxTopK = 30;
    private const int SnippetRadius = 90;
    private const int FragmentLength = 800;

    private static readonly ConcurrentDictionary<string, EditorIndexSnapshot> IndexSnapshots = new(StringComparer.Ordinal);
    private readonly AppDbContext _db;
    private readonly IChapterService _chapters;
    private readonly string _storageRoot;

    public EditorService(AppDbContext db, IChapterService chapters, IConfiguration configuration)
    {
        _db = db;
        _chapters = chapters;
        _storageRoot = DbServiceCollectionExtensions.ResolveStorageRoot(configuration);
    }

    public async Task<IReadOnlyList<EditorSearchResultDto>> SearchAsync(EditorSearchRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.ProjectId) || string.IsNullOrWhiteSpace(request.Query))
        {
            return Array.Empty<EditorSearchResultDto>();
        }

        var keywords = Tokenize(request.Query);
        if (keywords.Count == 0) return Array.Empty<EditorSearchResultDto>();

        var topK = Math.Clamp(request.TopK <= 0 ? 8 : request.TopK, 1, MaxTopK);
        var chapters = await _db.Chapters
            .AsNoTracking()
            .Where(c => c.ProjectId == request.ProjectId)
            .OrderBy(c => c.ChapterNumber)
            .ToListAsync(ct);

        var results = chapters
            .Select(c => ScoreChapter(c, keywords))
            .Where(r => r.Score > 0)
            .OrderByDescending(r => r.Score)
            .ThenBy(r => r.ChapterNumber)
            .Take(topK)
            .ToList();

        return results;
    }

    public async Task<EditorChapterAssistDto?> GetChapterAssistAsync(string chapterId, int relatedTopK = 6, CancellationToken ct = default)
    {
        var chapter = await _chapters.GetAsync(chapterId, ct);
        if (chapter == null) return null;

        var relatedQuery = string.Join(' ', new[] { chapter.Title, chapter.Summary }
            .Where(s => !string.IsNullOrWhiteSpace(s)));

        IReadOnlyList<EditorSearchResultDto> related = string.IsNullOrWhiteSpace(relatedQuery)
            ? Array.Empty<EditorSearchResultDto>()
            : (await SearchAsync(new EditorSearchRequest(chapter.ProjectId, relatedQuery, relatedTopK + 1), ct))
                .Where(r => r.ChapterId != chapter.Id)
                .Take(Math.Clamp(relatedTopK <= 0 ? 6 : relatedTopK, 1, MaxTopK))
                .ToList();

        return new EditorChapterAssistDto(chapter, related);
    }

    public Task<ChapterDto> SaveChapterContentAsync(string chapterId, EditorSaveChapterRequest request, CancellationToken ct = default)
        => _chapters.SaveContentAsync(chapterId, request.Content ?? string.Empty, request.Status ?? "drafted", ct);

    public async Task<EditorIndexRebuildResultDto> RebuildIndexAsync(string projectId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(projectId))
        {
            return new EditorIndexRebuildResultDto(string.Empty, 0, 0, 0, null, 0, "empty", 0);
        }

        var snapshot = await BuildIndexSnapshotAsync(projectId, ct);
        IndexSnapshots[projectId] = snapshot;
        var status = snapshot.ToStatus(staleChapterCount: 0);
        return new EditorIndexRebuildResultDto(
            status.ProjectId,
            status.IndexedChapterCount,
            status.TotalChapterCount,
            status.KeywordCount,
            status.LastBuiltAt,
            status.StaleChapterCount,
            status.Status,
            status.IndexedChapterCount);
    }

    public async Task<EditorIndexStatusDto> GetIndexStatusAsync(string projectId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(projectId))
        {
            return new EditorIndexStatusDto(string.Empty, 0, 0, 0, null, 0, "empty");
        }

        if (IndexSnapshots.TryGetValue(projectId, out var snapshot))
        {
            var staleChapterCount = await CountStaleChaptersAsync(snapshot, ct);
            return snapshot.ToStatus(staleChapterCount);
        }

        return (await BuildIndexSnapshotAsync(projectId, ct)).ToStatus(staleChapterCount: 0);
    }

    private async Task<EditorIndexSnapshot> BuildIndexSnapshotAsync(string projectId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(projectId))
        {
            return EditorIndexSnapshot.Empty(string.Empty);
        }

        var chapters = await _db.Chapters
            .AsNoTracking()
            .Where(c => c.ProjectId == projectId)
            .OrderBy(c => c.ChapterNumber)
            .ToListAsync(ct);

        var fragments = new List<EditorIndexFragment>();
        foreach (var chapter in chapters)
        {
            AddFragment(fragments, chapter.Id, "title", chapter.Title);
            AddFragment(fragments, chapter.Id, "summary", chapter.Summary);

            var content = ReadContent(chapter.ContentFilePath);
            for (var offset = 0; offset < content.Length; offset += FragmentLength)
            {
                var length = Math.Min(FragmentLength, content.Length - offset);
                AddFragment(fragments, chapter.Id, "content", content.Substring(offset, length));
            }
        }

        var indexedChapterIds = fragments
            .Select(f => f.ChapterId)
            .Distinct(StringComparer.Ordinal)
            .ToHashSet(StringComparer.Ordinal);
        var keywords = fragments
            .SelectMany(f => Tokenize(f.Text))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var chapterUpdatedAt = chapters.ToDictionary(c => c.Id, c => c.UpdatedAt, StringComparer.Ordinal);
        var sourceUpdatedAt = chapters.Count == 0 ? (DateTime?)null : chapters.Max(c => c.UpdatedAt);

        return new EditorIndexSnapshot(
            projectId,
            chapters.Count,
            indexedChapterIds.Count,
            keywords.Count,
            sourceUpdatedAt,
            chapterUpdatedAt);
    }

    private async Task<int> CountStaleChaptersAsync(EditorIndexSnapshot snapshot, CancellationToken ct)
    {
        var chapters = await _db.Chapters
            .AsNoTracking()
            .Where(c => c.ProjectId == snapshot.ProjectId)
            .Select(c => new { c.Id, c.UpdatedAt })
            .ToListAsync(ct);

        var staleCount = chapters.Count(c =>
            !snapshot.ChapterUpdatedAt.TryGetValue(c.Id, out var indexedAt) || c.UpdatedAt > indexedAt);
        var deletedCount = snapshot.ChapterUpdatedAt.Keys.Count(id => chapters.All(c => c.Id != id));

        return staleCount + deletedCount;
    }

    private static void AddFragment(List<EditorIndexFragment> fragments, string chapterId, string kind, string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return;

        fragments.Add(new EditorIndexFragment(chapterId, kind, text.Trim()));
    }

    private EditorSearchResultDto ScoreChapter(Chapter chapter, IReadOnlyList<string> keywords)
    {
        var title = chapter.Title ?? string.Empty;
        var summary = chapter.Summary ?? string.Empty;
        var content = ReadContent(chapter.ContentFilePath);
        var matched = new List<string>();
        double score = 0;

        foreach (var keyword in keywords)
        {
            var titleHits = CountOccurrences(title, keyword);
            var summaryHits = CountOccurrences(summary, keyword);
            var contentHits = CountOccurrences(content, keyword);
            var hits = titleHits + summaryHits + contentHits;
            if (hits == 0) continue;

            matched.Add(keyword);
            score += titleHits * 6;
            score += summaryHits * 3;
            score += Math.Min(contentHits, 20);
        }

        if (matched.Count > 1) score += matched.Count * 1.5;

        return new EditorSearchResultDto(
            chapter.Id,
            chapter.ProjectId,
            chapter.VolumeId,
            chapter.ChapterNumber,
            title,
            summary,
            BuildSnippet(content, summary, matched),
            Math.Round(score, 3),
            matched);
    }

    private string ReadContent(string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath)) return string.Empty;

        var fullPath = Path.Combine(_storageRoot, relativePath.Replace('/', Path.DirectorySeparatorChar));
        return File.Exists(fullPath) ? File.ReadAllText(fullPath) : string.Empty;
    }

    private static IReadOnlyList<string> Tokenize(string input)
    {
        var tokens = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var buffer = new StringBuilder();

        foreach (var ch in input.Normalize(NormalizationForm.FormKC))
        {
            if (char.IsLetterOrDigit(ch))
            {
                buffer.Append(char.ToLower(ch, CultureInfo.InvariantCulture));
                continue;
            }

            FlushToken(buffer, tokens);
        }

        FlushToken(buffer, tokens);

        return tokens
            .Where(t => t.Length >= 2)
            .OrderByDescending(t => t.Length)
            .Take(24)
            .ToList();
    }

    private static void FlushToken(StringBuilder buffer, HashSet<string> tokens)
    {
        if (buffer.Length == 0) return;

        var token = buffer.ToString();
        tokens.Add(token);

        if (ContainsCjk(token) && token.Length > 4)
        {
            for (var size = 2; size <= 4; size++)
            {
                for (var i = 0; i <= token.Length - size; i++)
                {
                    tokens.Add(token.Substring(i, size));
                }
            }
        }

        buffer.Clear();
    }

    private static bool ContainsCjk(string value)
        => value.Any(ch => ch >= 0x3400 && ch <= 0x9FFF);

    private static int CountOccurrences(string text, string keyword)
    {
        if (string.IsNullOrWhiteSpace(text) || string.IsNullOrWhiteSpace(keyword)) return 0;

        var count = 0;
        var index = 0;
        while ((index = CultureInfo.InvariantCulture.CompareInfo.IndexOf(
                   text,
                   keyword,
                   index,
                   CompareOptions.IgnoreCase | CompareOptions.IgnoreWidth | CompareOptions.IgnoreKanaType)) >= 0)
        {
            count++;
            index += keyword.Length;
        }

        return count;
    }

    private static string BuildSnippet(string content, string summary, IReadOnlyList<string> matched)
    {
        var source = string.IsNullOrWhiteSpace(content) ? summary : content;
        if (string.IsNullOrWhiteSpace(source)) return string.Empty;

        var hitIndex = matched
            .Select(k => CultureInfo.InvariantCulture.CompareInfo.IndexOf(
                source,
                k,
                CompareOptions.IgnoreCase | CompareOptions.IgnoreWidth | CompareOptions.IgnoreKanaType))
            .Where(i => i >= 0)
            .DefaultIfEmpty(0)
            .Min();

        var start = Math.Max(0, hitIndex - SnippetRadius);
        var length = Math.Min(source.Length - start, SnippetRadius * 2);
        return source.Substring(start, length)
            .Replace('\r', ' ')
            .Replace('\n', ' ')
            .Trim();
    }

    private sealed record EditorIndexFragment(string ChapterId, string Kind, string Text);

    private sealed record EditorIndexSnapshot(
        string ProjectId,
        int TotalChapterCount,
        int IndexedChapterCount,
        int KeywordCount,
        DateTime? LastBuiltAt,
        IReadOnlyDictionary<string, DateTime> ChapterUpdatedAt)
    {
        public static EditorIndexSnapshot Empty(string projectId)
            => new(projectId, 0, 0, 0, null, new Dictionary<string, DateTime>(StringComparer.Ordinal));

        public EditorIndexStatusDto ToStatus(int staleChapterCount)
        {
            var status = TotalChapterCount == 0 || IndexedChapterCount == 0 || KeywordCount == 0
                ? "empty"
                : staleChapterCount > 0
                    ? "stale"
                    : "ready";

            return new(
                ProjectId,
                IndexedChapterCount,
                TotalChapterCount,
                KeywordCount,
                LastBuiltAt,
                staleChapterCount,
                status);
        }
    }
}
