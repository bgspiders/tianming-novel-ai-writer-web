using Microsoft.Playwright;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;
using TM.Web.Application.Dtos;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Design;

public sealed class BookAnalysisCrawlerService : IBookAnalysisCrawlerService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly IAiCompletionService _ai;
    private readonly IAiApiKeyService _apiKeys;
    private readonly IBookAnalysisBackgroundJobQueue _backgroundJobs;
    private readonly AppDbContext _db;

    public BookAnalysisCrawlerService(
        IAiCompletionService ai,
        IAiApiKeyService apiKeys,
        IBookAnalysisBackgroundJobQueue backgroundJobs,
        AppDbContext db)
    {
        _ai = ai;
        _apiKeys = apiKeys;
        _backgroundJobs = backgroundJobs;
        _db = db;
    }

    public async Task<BookAnalysisCrawlPreviewDto> CrawlPreviewAsync(
        BookAnalysisCrawlPreviewRequest request,
        CancellationToken ct = default)
    {
        if (!Uri.TryCreate(request.Url, UriKind.Absolute, out var uri))
        {
            throw new InvalidOperationException("Invalid crawl URL.");
        }

        var maxChapters = Math.Clamp(request.MaxChapters, 1, 50);

        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
        {
            Headless = true
        });

        var context = await browser.NewContextAsync(new BrowserNewContextOptions
        {
            Locale = "zh-CN",
            UserAgent = "TM.Web.Bot/1.0 (Playwright)"
        });

        var page = await context.NewPageAsync();
        page.SetDefaultNavigationTimeout(45000);
        page.SetDefaultTimeout(15000);

        await page.GotoAsync(uri.ToString(), new PageGotoOptions
        {
            WaitUntil = WaitUntilState.DOMContentLoaded
        });

        await page.WaitForTimeoutAsync(1200);
        var preview = await ExtractPreviewAsync(page, uri, maxChapters, request.IncludeContent, ct);
        await context.CloseAsync();
        return preview;
    }

    public async Task<BookAnalysisCrawlPreviewDto> AnalyzePreviewAsync(
        BookAnalysisAiAnalyzeRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.ProviderId))
        {
            throw new ArgumentException("ProviderId 不能为空。", nameof(request));
        }
        if (string.IsNullOrWhiteSpace(request.Endpoint))
        {
            throw new ArgumentException("Endpoint 不能为空。", nameof(request));
        }
        if (string.IsNullOrWhiteSpace(request.Model))
        {
            throw new ArgumentException("Model 不能为空。", nameof(request));
        }

        var apiKey = string.IsNullOrWhiteSpace(request.ApiKeyId)
            ? await _apiKeys.RotateNextPlainKeyAsync(request.ProviderId, ct)
            : await _apiKeys.GetPlainKeyAsync(request.ApiKeyId!, ct);

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("当前 Provider 没有可用 Key。");
        }

        var result = await _ai.StreamAsync(new AiTestRequest
        {
            RunId = Guid.NewGuid().ToString("N"),
            Endpoint = request.Endpoint,
            ApiKey = apiKey,
            Model = request.Model,
            SystemPrompt = BuildAnalyzeSystemPrompt(),
            Prompt = BuildAnalyzeUserPrompt(request.Preview),
            Temperature = 0.2f,
            MaxTokens = Math.Clamp(request.MaxTokens, 1024, 6000)
        }, ct);

        var ai = ParseAnalyzeResult(result.Content);
        return request.Preview with
        {
            WorldBuildingMethod = Pick(ai.WorldBuildingMethod, request.Preview.WorldBuildingMethod),
            PowerSystemDesign = Pick(ai.PowerSystemDesign, request.Preview.PowerSystemDesign),
            EnvironmentDescription = Pick(ai.EnvironmentDescription, request.Preview.EnvironmentDescription),
            FactionDesign = Pick(ai.FactionDesign, request.Preview.FactionDesign),
            WorldviewHighlights = Pick(ai.WorldviewHighlights, request.Preview.WorldviewHighlights),
            ProtagonistDesign = Pick(ai.ProtagonistDesign, request.Preview.ProtagonistDesign),
            SupportingRoles = Pick(ai.SupportingRoles, request.Preview.SupportingRoles),
            CharacterRelations = Pick(ai.CharacterRelations, request.Preview.CharacterRelations),
            GoldenFingerDesign = Pick(ai.GoldenFingerDesign, request.Preview.GoldenFingerDesign),
            CharacterHighlights = Pick(ai.CharacterHighlights, request.Preview.CharacterHighlights),
            PlotStructure = Pick(ai.PlotStructure, request.Preview.PlotStructure),
            ConflictDesign = Pick(ai.ConflictDesign, request.Preview.ConflictDesign),
            ClimaxArrangement = Pick(ai.ClimaxArrangement, request.Preview.ClimaxArrangement),
            ForeshadowingTechnique = Pick(ai.ForeshadowingTechnique, request.Preview.ForeshadowingTechnique),
            PlotHighlights = Pick(ai.PlotHighlights, request.Preview.PlotHighlights)
        };
    }

    public async Task<BookAnalysisBackgroundAnalyzeAcceptedDto> QueueBackgroundAnalyzeAsync(
        string bookAnalysisId,
        BookAnalysisBackgroundAnalyzeRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(bookAnalysisId))
        {
            throw new ArgumentException("BookAnalysisId 不能为空。", nameof(bookAnalysisId));
        }
        if (string.IsNullOrWhiteSpace(request.ProviderId))
        {
            throw new ArgumentException("ProviderId 不能为空。", nameof(request));
        }
        if (string.IsNullOrWhiteSpace(request.Endpoint))
        {
            throw new ArgumentException("Endpoint 不能为空。", nameof(request));
        }
        if (string.IsNullOrWhiteSpace(request.Model))
        {
            throw new ArgumentException("Model 不能为空。", nameof(request));
        }

        var entity = await _db.BookAnalyses.FirstOrDefaultAsync(x => x.Id == bookAnalysisId, ct)
            ?? throw new InvalidOperationException("拆书数据不存在。");

        var jobId = Guid.NewGuid().ToString("N");
        entity.BackgroundAiStatus = "queued";
        entity.BackgroundAiJobId = jobId;
        entity.BackgroundAiRequestedAt = DateTime.UtcNow;
        entity.BackgroundAiFinishedAt = null;
        entity.BackgroundAiMessage = "Queued for background AI analysis.";
        await _db.SaveChangesAsync(ct);

        await _backgroundJobs.EnqueueAsync(new BookAnalysisBackgroundAnalyzeJob(
            jobId,
            bookAnalysisId,
            request,
            entity.BackgroundAiRequestedAt.Value), ct);

        return new BookAnalysisBackgroundAnalyzeAcceptedDto(jobId, bookAnalysisId, entity.BackgroundAiStatus);
    }

    private static string BuildAnalyzeSystemPrompt()
        => """
           你是专业网文拆书分析师。请根据用户提供的书籍元信息、简介和章节样本，提炼可复用的创作方法。
           必须只输出一个 JSON 对象，不要 Markdown，不要解释。JSON 字段必须使用用户指定的英文键。
           每个字段输出中文，内容要具体、可执行，避免空泛形容。
           """;

    private static string BuildAnalyzeUserPrompt(BookAnalysisCrawlPreviewDto preview)
    {
        var sb = new StringBuilder();
        sb.AppendLine("请分析以下小说拆书样本，并只返回 JSON：");
        sb.AppendLine();
        sb.AppendLine("JSON 字段：");
        sb.AppendLine("""
        {
          "worldBuildingMethod": "",
          "powerSystemDesign": "",
          "environmentDescription": "",
          "factionDesign": "",
          "worldviewHighlights": "",
          "protagonistDesign": "",
          "supportingRoles": "",
          "characterRelations": "",
          "goldenFingerDesign": "",
          "characterHighlights": "",
          "plotStructure": "",
          "conflictDesign": "",
          "climaxArrangement": "",
          "foreshadowingTechnique": "",
          "plotHighlights": ""
        }
        """);
        sb.AppendLine();
        sb.AppendLine($"标题：{preview.Title}");
        sb.AppendLine($"作者：{preview.Author}");
        sb.AppendLine($"类型：{preview.Genre}");
        sb.AppendLine($"关键词：{preview.Keywords}");
        sb.AppendLine($"摘要：{TrimForPrompt(preview.Summary, 1800)}");
        sb.AppendLine();
        sb.AppendLine("章节样本：");
        foreach (var chapter in preview.Chapters.Take(12))
        {
            sb.AppendLine($"## {chapter.Index}. {chapter.Title}（{chapter.WordCount}字）");
            sb.AppendLine(TrimForPrompt(string.IsNullOrWhiteSpace(chapter.Summary) ? chapter.Content : chapter.Summary, 900));
        }
        return sb.ToString();
    }

    private static BookAnalysisAiResult ParseAnalyzeResult(string? content)
    {
        var json = ExtractJson(content);
        if (string.IsNullOrWhiteSpace(json))
        {
            throw new InvalidOperationException("AI 没有返回可解析的 JSON。");
        }

        try
        {
            return JsonSerializer.Deserialize<BookAnalysisAiResult>(json, JsonOptions)
                ?? throw new InvalidOperationException("AI 返回 JSON 为空。");
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException($"AI 返回 JSON 解析失败：{ex.Message}");
        }
    }

    private static string ExtractJson(string? content)
    {
        if (string.IsNullOrWhiteSpace(content)) return string.Empty;
        var text = content.Trim();
        if (text.StartsWith("```", StringComparison.Ordinal))
        {
            var firstLineEnd = text.IndexOf('\n');
            if (firstLineEnd >= 0) text = text[(firstLineEnd + 1)..];
            var fence = text.LastIndexOf("```", StringComparison.Ordinal);
            if (fence >= 0) text = text[..fence];
        }

        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        return start >= 0 && end > start ? text[start..(end + 1)] : text;
    }

    private static string Pick(string? primary, string fallback)
        => string.IsNullOrWhiteSpace(primary) ? fallback : primary.Trim();

    private static string TrimForPrompt(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var text = value.Trim();
        return text.Length <= maxLength ? text : text[..maxLength];
    }

    private static async Task<BookAnalysisCrawlPreviewDto> ExtractPreviewAsync(
        IPage page,
        Uri sourceUri,
        int maxChapters,
        bool includeContent,
        CancellationToken ct)
    {
        var meta = await ExtractMetaAsync(page);
        var chapterLinks = await ExtractChapterLinksAsync(page, sourceUri, maxChapters);
        var chapters = new List<BookAnalysisCrawlChapterDto>();

        if (includeContent)
        {
            foreach (var chapter in chapterLinks)
            {
                ct.ThrowIfCancellationRequested();

                var content = await ExtractChapterContentAsync(page.Context, chapter.Url, chapter.Title);
                chapters.Add(new BookAnalysisCrawlChapterDto(
                    chapter.Index,
                    content.Title,
                    chapter.Url,
                    BuildSummary(content.Content, 120),
                    content.WordCount,
                    content.Content));
            }
        }
        else
        {
            chapters.AddRange(chapterLinks.Select(chapter => new BookAnalysisCrawlChapterDto(
                chapter.Index,
                chapter.Title,
                chapter.Url,
                string.Empty,
                0,
                string.Empty)));
        }

        var totalWordCount = chapters.Sum(x => x.WordCount);

        return new BookAnalysisCrawlPreviewDto(
            SourceUrl: sourceUri.ToString(),
            SourceSite: sourceUri.Host,
            SuggestedName: string.IsNullOrWhiteSpace(meta.Title) ? sourceUri.Host : meta.Title,
            Title: meta.Title,
            Author: meta.Author,
            Genre: meta.Genre,
            Keywords: meta.Keywords,
            ChapterCount: chapters.Count,
            TotalWordCount: totalWordCount,
            CrawledAt: DateTime.UtcNow,
            Summary: BuildOverallSummary(meta, chapters),
            WorldBuildingMethod: BuildField(meta.Description, chapters, "\u4e16\u754c\u89c2", "\u8bbe\u5b9a", "\u95e8\u6d3e", "\u5b97\u95e8", "\u738b\u671d", "\u5b66\u9662", "\u5927\u9646", "\u4f4d\u9762"),
            PowerSystemDesign: BuildField(meta.Description, chapters, "\u4fee\u70bc", "\u4f53\u7cfb", "\u529f\u6cd5", "\u5883\u754c", "\u5347\u7ea7", "\u80fd\u529b", "\u5929\u8d4b"),
            EnvironmentDescription: BuildField(meta.Description, chapters, "\u73af\u5883", "\u573a\u666f", "\u5730\u8c8c", "\u57ce\u5e02", "\u79d8\u5883", "\u6218\u573a"),
            FactionDesign: BuildField(meta.Description, chapters, "\u52bf\u529b", "\u5b97\u95e8", "\u5bb6\u65cf", "\u671d\u5ef7", "\u8054\u76df", "\u5e2e\u6d3e"),
            WorldviewHighlights: BuildField(meta.Description, chapters, "\u4eae\u70b9", "\u7279\u8272", "\u4e16\u754c", "\u8bbe\u5b9a", "\u89c4\u5219"),
            ProtagonistDesign: BuildField(meta.Description, chapters, "\u4e3b\u89d2", "\u5c11\u5e74", "\u5c11\u5973", "\u7a7f\u8d8a", "\u91cd\u751f", "\u5929\u624d"),
            SupportingRoles: BuildField(meta.Description, chapters, "\u914d\u89d2", "\u4f19\u4f34", "\u5e08\u7236", "\u53cd\u6d3e", "\u540c\u4f34"),
            CharacterRelations: BuildField(meta.Description, chapters, "\u5173\u7cfb", "\u5e08\u5f92", "\u7236\u5b50", "\u5144\u5f1f", "\u7231\u6155", "\u8054\u76df"),
            GoldenFingerDesign: BuildField(meta.Description, chapters, "\u7cfb\u7edf", "\u5916\u6302", "\u91d1\u624b\u6307", "\u9762\u677f", "\u5947\u9047", "\u795e\u5668"),
            CharacterHighlights: BuildField(meta.Description, chapters, "\u4eba\u7269", "\u6027\u683c", "\u6210\u957f", "\u53cd\u5dee", "\u9b45\u529b"),
            PlotStructure: BuildField(meta.Description, chapters, "\u5267\u60c5", "\u4e3b\u7ebf", "\u652f\u7ebf", "\u7bc7\u7ae0", "\u9636\u6bb5"),
            ConflictDesign: BuildField(meta.Description, chapters, "\u51b2\u7a81", "\u5bf9\u6297", "\u5371\u673a", "\u8ffd\u6740", "\u7ade\u4e89"),
            ClimaxArrangement: BuildField(meta.Description, chapters, "\u9ad8\u6f6e", "\u51b3\u6218", "\u53cd\u8f6c", "\u7206\u53d1"),
            ForeshadowingTechnique: BuildField(meta.Description, chapters, "\u4f0f\u7b14", "\u6697\u7ebf", "\u79d8\u5bc6", "\u7ebf\u7d22"),
            PlotHighlights: BuildField(meta.Description, chapters, "\u723d\u70b9", "\u7206\u70b9", "\u540d\u573a\u9762", "\u4eae\u70b9"),
            Chapters: chapters);
    }

    private static async Task<MetaPayload> ExtractMetaAsync(IPage page)
    {
        return await page.EvaluateAsync<MetaPayload>(
            """
            () => {
              const pickMeta = (...keys) => {
                for (const key of keys) {
                  const node = document.querySelector(`meta[name="${key}"],meta[property="${key}"]`);
                  const content = node?.getAttribute('content')?.trim();
                  if (content) return content;
                }
                return '';
              };

              const text = (selectors) => {
                for (const selector of selectors) {
                  const node = document.querySelector(selector);
                  const value = node?.textContent?.trim();
                  if (value) return value;
                }
                return '';
              };

              const title = pickMeta('og:novel:book_name', 'og:title', 'twitter:title')
                || text(['h1', '.book-title', '.info h1', '.bookname h1'])
                || document.title
                || '';
              const author = pickMeta('og:novel:author', 'author')
                || text(['.author', '.book-author', '.info .small span', '.small span'])
                || '';
              const genre = pickMeta('og:novel:category', 'category')
                || text(['.tag', '.cat', '.book-meta .genre'])
                || '';
              const keywords = pickMeta('keywords');
              const description = pickMeta('description', 'og:description')
                || text(['#intro', '.intro', '.book-intro', '.desc', '.book-dec'])
                || '';

              return { title, author, genre, keywords, description };
            }
            """);
    }

    private static async Task<IReadOnlyList<ChapterLinkPayload>> ExtractChapterLinksAsync(IPage page, Uri sourceUri, int maxChapters)
    {
        var links = await page.EvaluateAsync<List<ChapterLinkPayload>>(
            """
            (limit) => {
              const nodes = Array.from(document.querySelectorAll('a[href]'));
              const chapterRegex = /(\u7b2c.{1,12}[\u7ae0\u56de\u8282\u96c6\u5377]|chapter\s*\d+|\u6b63\u6587)/i;

              const normalized = nodes
                .map((node, index) => ({
                  index: index + 1,
                  title: (node.textContent || '').trim(),
                  url: node.href || ''
                }))
                .filter(item => item.title && item.url && chapterRegex.test(item.title));

              const unique = [];
              const seen = new Set();
              for (const item of normalized) {
                if (seen.has(item.url)) continue;
                seen.add(item.url);
                unique.push(item);
                if (unique.length >= limit) break;
              }

              return unique;
            }
            """, maxChapters);

        return links
            .Where(x => !string.IsNullOrWhiteSpace(x.Title) && Uri.TryCreate(sourceUri, x.Url, out _))
            .Select(x => x with
            {
                Title = x.Title.Trim(),
                Url = NormalizeUrl(sourceUri, x.Url)
            })
            .ToList();
    }

    private static async Task<(string Title, string Content, int WordCount)> ExtractChapterContentAsync(
        IBrowserContext context,
        string url,
        string fallbackTitle)
    {
        var page = await context.NewPageAsync();
        try
        {
            page.SetDefaultNavigationTimeout(30000);
            page.SetDefaultTimeout(10000);

            await page.GotoAsync(url, new PageGotoOptions
            {
                WaitUntil = WaitUntilState.DOMContentLoaded
            });

            await page.WaitForTimeoutAsync(600);

            var result = await page.EvaluateAsync<ChapterContentPayload>(
                """
                () => {
                  const text = (selectors) => {
                    for (const selector of selectors) {
                      const node = document.querySelector(selector);
                      const value = node?.textContent?.trim();
                      if (value) return value;
                    }
                    return '';
                  };

                  const title = text(['h1', '.chapter-title', '.bookname h1', '.content h1']) || document.title || '';
                  const contentNode =
                    document.querySelector('#content') ||
                    document.querySelector('.content') ||
                    document.querySelector('.read-content') ||
                    document.querySelector('.chapter-content') ||
                    document.querySelector('article');

                  const content = contentNode?.textContent?.replace(/\u00a0/g, ' ')?.replace(/\s+\n/g, '\n')?.trim() || '';
                  return { title, content };
                }
                """);

            var content = NormalizeText(result.Content);
            return (
                string.IsNullOrWhiteSpace(result.Title) ? fallbackTitle : result.Title.Trim(),
                content,
                content.Length);
        }
        catch
        {
            return (fallbackTitle, string.Empty, 0);
        }
        finally
        {
            await page.CloseAsync();
        }
    }

    private static string NormalizeUrl(Uri sourceUri, string url)
    {
        return Uri.TryCreate(sourceUri, url, out var resolved)
            ? resolved.ToString()
            : url;
    }

    private static string NormalizeText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var normalized = value.Replace("\r", string.Empty);
        var lines = normalized
            .Split('\n')
            .Select(line => line.Trim())
            .Where(line => !string.IsNullOrWhiteSpace(line));

        return string.Join("\n", lines);
    }

    private static string BuildSummary(string text, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return string.Empty;
        }

        return text.Length <= maxLength
            ? text
            : $"{text[..maxLength].Trim()}...";
    }

    private static string BuildOverallSummary(MetaPayload meta, IReadOnlyList<BookAnalysisCrawlChapterDto> chapters)
    {
        var parts = new List<string>();

        if (!string.IsNullOrWhiteSpace(meta.Title))
        {
            parts.Add($"\u300a{meta.Title}\u300b");
        }

        if (!string.IsNullOrWhiteSpace(meta.Author))
        {
            parts.Add($"\u4f5c\u8005\uff1a{meta.Author}");
        }

        if (!string.IsNullOrWhiteSpace(meta.Genre))
        {
            parts.Add($"\u9898\u6750\uff1a{meta.Genre}");
        }

        if (!string.IsNullOrWhiteSpace(meta.Description))
        {
            parts.Add(BuildSummary(NormalizeText(meta.Description), 160));
        }

        var chapterTitles = chapters
            .Select(x => x.Title)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Take(5)
            .ToArray();

        if (chapterTitles.Length > 0)
        {
            parts.Add($"\u6837\u672c\u7ae0\u8282\uff1a{string.Join("\u3001", chapterTitles)}");
        }

        return string.Join("\uff1b", parts);
    }

    private static string BuildField(
        string description,
        IReadOnlyList<BookAnalysisCrawlChapterDto> chapters,
        params string[] keywords)
    {
        var snippets = new List<string>();
        var sourcePool = new List<string>();

        if (!string.IsNullOrWhiteSpace(description))
        {
            sourcePool.Add(NormalizeText(description));
        }

        sourcePool.AddRange(chapters
            .Select(x => x.Content)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Take(8));

        foreach (var source in sourcePool)
        {
            var matched = keywords.FirstOrDefault(keyword => source.Contains(keyword, StringComparison.OrdinalIgnoreCase));
            if (matched is null)
            {
                continue;
            }

            var snippet = ExtractSnippet(source, matched, 90);
            if (!string.IsNullOrWhiteSpace(snippet) && !snippets.Contains(snippet))
            {
                snippets.Add(snippet);
            }

            if (snippets.Count >= 3)
            {
                break;
            }
        }

        if (snippets.Count == 0)
        {
            var fallback = sourcePool.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x));
            return BuildSummary(fallback ?? string.Empty, 140);
        }

        return string.Join("\n", snippets);
    }

    private static string ExtractSnippet(string source, string keyword, int radius)
    {
        var index = source.IndexOf(keyword, StringComparison.OrdinalIgnoreCase);
        if (index < 0)
        {
            return string.Empty;
        }

        var start = Math.Max(0, index - radius / 2);
        var length = Math.Min(source.Length - start, radius);
        var snippet = source.Substring(start, length).Trim();
        return snippet.Length == 0 ? string.Empty : snippet;
    }

    private sealed record ChapterLinkPayload(int Index, string Title, string Url);
    private sealed record ChapterContentPayload(string Title, string Content);
    private sealed record MetaPayload(string Title, string Author, string Genre, string Keywords, string Description);

    private sealed record BookAnalysisAiResult(
        string? WorldBuildingMethod,
        string? PowerSystemDesign,
        string? EnvironmentDescription,
        string? FactionDesign,
        string? WorldviewHighlights,
        string? ProtagonistDesign,
        string? SupportingRoles,
        string? CharacterRelations,
        string? GoldenFingerDesign,
        string? CharacterHighlights,
        string? PlotStructure,
        string? ConflictDesign,
        string? ClimaxArrangement,
        string? ForeshadowingTechnique,
        string? PlotHighlights);
}
