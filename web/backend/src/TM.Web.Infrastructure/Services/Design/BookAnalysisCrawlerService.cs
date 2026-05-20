using Microsoft.Playwright;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;

namespace TM.Web.Infrastructure.Services.Design;

public sealed class BookAnalysisCrawlerService : IBookAnalysisCrawlerService
{
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
}
