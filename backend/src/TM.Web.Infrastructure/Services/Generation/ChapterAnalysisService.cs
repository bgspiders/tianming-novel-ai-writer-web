using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Domain.Entities.Runtime;
using TM.Web.Domain.Entities.Tracking;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Generation;

public sealed class ChapterAnalysisService : IChapterAnalysisService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly AppDbContext _db;
    private readonly string _storageRoot;

    public ChapterAnalysisService(AppDbContext db, IConfiguration configuration)
    {
        _db = db;
        _storageRoot = DbServiceCollectionExtensions.ResolveStorageRoot(configuration);
    }

    public async Task<ChapterAnalysisResult> AnalyzeAsync(ChapterAnalysisRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.ProjectId)) throw new InvalidOperationException("项目 ID 不能为空。");
        if (string.IsNullOrWhiteSpace(request.ChapterId)) throw new InvalidOperationException("章节 ID 不能为空。");

        var chapter = await _db.Chapters.FirstOrDefaultAsync(x => x.Id == request.ChapterId && x.ProjectId == request.ProjectId, ct)
            ?? throw new InvalidOperationException("章节不存在或不属于当前项目。");

        var content = await ReadChapterContentAsync(chapter.ContentFilePath, ct);
        if (string.IsNullOrWhiteSpace(content))
        {
            content = chapter.Summary;
        }

        var wordCount = CountWords(content);
        var items = new List<GenerationCheckItemDto>();
        if (wordCount < request.MinWordCount)
        {
            items.Add(new GenerationCheckItemDto
            {
                Code = "chapter_too_short",
                Severity = "fatal",
                Message = $"章节正文过短，当前 {wordCount} 字，最低要求 {request.MinWordCount} 字。",
                Suggestion = "重新生成或继续扩写本章后再进入批量下一章。"
            });
        }

        var duplicateTitles = await FindRecentDuplicateTitlesAsync(chapter.ProjectId, chapter.ChapterNumber, chapter.Title, request.MaxDuplicateTitleWindow, ct);
        if (duplicateTitles.Count > 0)
        {
            items.Add(new GenerationCheckItemDto
            {
                Code = "duplicate_recent_title",
                Severity = "warning",
                Message = $"近 {request.MaxDuplicateTitleWindow} 章内存在重复或近似标题：{string.Join("、", duplicateTitles)}。",
                Suggestion = "先重写章节标题和简介，避免批量生成跑成同质章节。"
            });
        }

        items.AddRange(await CheckSceneBlueprintGroundingAsync(chapter, content, ct));
        items.AddRange(await CheckLockedFactsAsync(chapter, content, ct));
        items.AddRange(await CheckForeshadowingPayoffAsync(chapter, content, ct));
        items.AddRange(CheckRepeatedParagraphs(content));
        items.AddRange(CheckEndingHook(content));

        var fatalCount = items.Count(x => x.Severity == "fatal");
        var warningCount = items.Count(x => x.Severity == "warning");
        var qualityScore = Math.Clamp(10 - fatalCount * 4 - warningCount, 1, 10);
        var coherenceScore = Math.Clamp(10 - fatalCount * 3, 1, 10);
        var summary = BuildSummary(content, chapter.Title);
        var passed = fatalCount == 0 && qualityScore >= 7 && coherenceScore >= 7;
        var report = new ChapterAnalysisReport
        {
            ProjectId = request.ProjectId,
            ChapterId = request.ChapterId,
            Passed = passed,
            ShouldPauseBatch = !passed,
            WordCount = wordCount,
            CoherenceScore = coherenceScore,
            QualityScore = qualityScore,
            Summary = summary,
            ItemsJson = JsonSerializer.Serialize(items, JsonOptions)
        };
        _db.ChapterAnalysisReports.Add(report);

        if (request.UpdateChapterSummary && !string.IsNullOrWhiteSpace(summary))
        {
            chapter.Summary = summary;
        }

        await ApplyTrackingUpdatesAsync(chapter, content, summary, ct);

        await _db.SaveChangesAsync(ct);

        return new ChapterAnalysisResult
        {
            Id = report.Id,
            ProjectId = report.ProjectId,
            ChapterId = report.ChapterId,
            Passed = report.Passed,
            ShouldPauseBatch = report.ShouldPauseBatch,
            WordCount = report.WordCount,
            CoherenceScore = report.CoherenceScore,
            QualityScore = report.QualityScore,
            Summary = report.Summary,
            Items = items,
            CreatedAt = report.CreatedAt
        };
    }

    private async Task<string> ReadChapterContentAsync(string? relativePath, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(relativePath)) return string.Empty;
        var fullPath = Path.Combine(_storageRoot, relativePath.Replace('/', Path.DirectorySeparatorChar));
        return File.Exists(fullPath) ? await File.ReadAllTextAsync(fullPath, ct) : string.Empty;
    }

    private async Task<List<string>> FindRecentDuplicateTitlesAsync(
        string projectId,
        int chapterNumber,
        string title,
        int window,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(title) || window <= 0) return new List<string>();
        var start = Math.Max(1, chapterNumber - window);
        var end = chapterNumber + window;
        var normalizedTitle = NormalizeTitle(title);
        var rows = await _db.Chapters.AsNoTracking()
            .Where(x => x.ProjectId == projectId && x.Id != string.Empty && x.ChapterNumber >= start && x.ChapterNumber <= end && x.ChapterNumber != chapterNumber)
            .Select(x => new { x.ChapterNumber, x.Title })
            .ToListAsync(ct);

        return rows
            .Where(x => NormalizeTitle(x.Title) == normalizedTitle)
            .OrderBy(x => x.ChapterNumber)
            .Select(x => $"第{x.ChapterNumber}章《{x.Title}》")
            .ToList();
    }

    private async Task<IReadOnlyList<GenerationCheckItemDto>> CheckSceneBlueprintGroundingAsync(
        TM.Web.Domain.Entities.Core.Chapter chapter,
        string content,
        CancellationToken ct)
    {
        var blueprints = await _db.ChapterBlueprints.AsNoTracking()
            .Where(x => x.ChapterId == chapter.Id && x.IsEnabled)
            .OrderBy(x => x.SceneNumber)
            .ToListAsync(ct);
        if (blueprints.Count == 0) return Array.Empty<GenerationCheckItemDto>();

        var missing = new List<string>();
        var missingForeshadowings = new List<string>();
        var missingTimeAnchors = new List<string>();
        var missingLocationAnchors = new List<string>();
        var missingTimelineEffects = new List<string>();
        foreach (var blueprint in blueprints)
        {
            var anchors = ExtractSceneGroundingAnchors(blueprint).Take(8).ToList();
            if (anchors.Count == 0) continue;

            var hitCount = anchors.Count(anchor => ContainsLoose(content, anchor));
            var requiredHits = anchors.Count >= 4 ? 2 : 1;
            if (hitCount < requiredHits)
            {
                missing.Add($"场景{blueprint.SceneNumber}《{FirstNonEmpty(blueprint.SceneTitle, blueprint.Name)}》");
            }

            var sceneLabel = $"场景{blueprint.SceneNumber}《{FirstNonEmpty(blueprint.SceneTitle, blueprint.Name)}》";
            var foreshadowingName = ExtractTaggedValue(blueprint.Cast, "伏笔");
            if (!string.IsNullOrWhiteSpace(foreshadowingName) && !IsGrounded(content, foreshadowingName))
            {
                missingForeshadowings.Add($"{sceneLabel}:{foreshadowingName}");
            }

            var timeAnchor = ExtractTaggedValue(blueprint.InfoDrop, "时间");
            if (!string.IsNullOrWhiteSpace(timeAnchor) && !IsGrounded(content, timeAnchor))
            {
                missingTimeAnchors.Add($"{sceneLabel}:{timeAnchor}");
            }

            var locationAnchor = FirstNonEmpty(blueprint.Locations, ExtractTaggedValue(blueprint.InfoDrop, "地点"));
            if (!string.IsNullOrWhiteSpace(locationAnchor) && !IsGrounded(content, locationAnchor))
            {
                missingLocationAnchors.Add($"{sceneLabel}:{locationAnchor}");
            }

            var timelineEffect = ExtractTaggedValue(blueprint.InfoDrop, "时间线");
            if (!string.IsNullOrWhiteSpace(timelineEffect) && !IsGrounded(content, timelineEffect))
            {
                missingTimelineEffects.Add($"{sceneLabel}:{timelineEffect}");
            }
        }

        var items = new List<GenerationCheckItemDto>();
        if (missing.Count > 0)
        {
            items.Add(new GenerationCheckItemDto
            {
                Code = "scene_blueprint_not_grounded",
                Severity = "fatal",
                Message = $"章节正文未充分落地场景蓝图：{string.Join("、", missing.Take(5))}。",
                Suggestion = "按场景蓝图补写关键动作、地点、信息增量后再继续批量生成。"
            });
        }

        if (missingForeshadowings.Count > 0)
        {
            items.Add(new GenerationCheckItemDto
            {
                Code = "scene_foreshadowing_missing",
                Severity = "fatal",
                Message = $"章节正文未覆盖场景指定伏笔：{string.Join("、", missingForeshadowings.Take(5))}。",
                Suggestion = "补写场景卡指定的伏笔埋设、推进或回收动作，避免批量长文跑偏。"
            });
        }

        if (missingTimeAnchors.Count > 0)
        {
            items.Add(new GenerationCheckItemDto
            {
                Code = "scene_time_anchor_missing",
                Severity = "warning",
                Message = $"章节正文未明确场景时间锚点：{string.Join("、", missingTimeAnchors.Take(5))}。",
                Suggestion = "补写时间承接或经过，让连续章节的时间线更清楚。"
            });
        }

        if (missingLocationAnchors.Count > 0)
        {
            items.Add(new GenerationCheckItemDto
            {
                Code = "scene_location_anchor_missing",
                Severity = "warning",
                Message = $"章节正文未明确场景地点锚点：{string.Join("、", missingLocationAnchors.Take(5))}。",
                Suggestion = "补写场景地点或移动过程，避免地点无故跳跃。"
            });
        }

        if (missingTimelineEffects.Count > 0)
        {
            items.Add(new GenerationCheckItemDto
            {
                Code = "scene_timeline_effect_missing",
                Severity = "warning",
                Message = $"章节正文未明确场景时间线影响：{string.Join("、", missingTimelineEffects.Take(5))}。",
                Suggestion = "补写本场景对主线状态、伏笔状态或后续行动的影响。"
            });
        }

        return items;
    }

    private static IReadOnlyList<string> ExtractSceneGroundingAnchors(ChapterBlueprint blueprint)
    {
        var anchors = ExtractAnchors(new[]
        {
            blueprint.Opening,
            blueprint.Development,
            blueprint.Turning,
            blueprint.Ending,
            blueprint.InfoDrop,
            blueprint.Locations
        }).ToList();
        if (anchors.Count > 0) return anchors;

        return ExtractAnchors(new[]
        {
            CleanSceneTitleForGrounding(FirstNonEmpty(blueprint.SceneTitle, blueprint.Name))
        });
    }

    private static string CleanSceneTitleForGrounding(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var parts = value.Split(new[] { '·', '：', ':', '-', '—' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parts.FirstOrDefault(x => !SceneTitleSuffixStopWords.Contains(x)) ?? value;
    }

    private async Task<IReadOnlyList<GenerationCheckItemDto>> CheckLockedFactsAsync(
        TM.Web.Domain.Entities.Core.Chapter chapter,
        string content,
        CancellationToken ct)
    {
        var sourceBookId = await _db.Projects.AsNoTracking()
            .Where(x => x.Id == chapter.ProjectId)
            .Select(x => x.CurrentSourceBookId)
            .FirstOrDefaultAsync(ct);
        var prefix = $"tianming.kb.{chapter.ProjectId}.{sourceBookId ?? "global"}.";
        var archive = await _db.AppSettings.AsNoTracking()
            .Where(x => x.Key == prefix + "archive_events")
            .Select(x => x.Value)
            .FirstOrDefaultAsync(ct);
        if (string.IsNullOrWhiteSpace(archive)) return Array.Empty<GenerationCheckItemDto>();

        var lockedLines = archive.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(x => x.Contains("锁定", StringComparison.OrdinalIgnoreCase)
                || x.Contains("不可改写", StringComparison.OrdinalIgnoreCase)
                || x.Contains("必须", StringComparison.OrdinalIgnoreCase))
            .Take(20)
            .ToList();
        if (lockedLines.Count == 0) return Array.Empty<GenerationCheckItemDto>();

        var missing = lockedLines
            .Where(line =>
            {
                var anchors = ExtractAnchors(new[] { line }).Take(6).ToList();
                return anchors.Count > 0 && anchors.Count(anchor => ContainsLoose(content, anchor)) < Math.Min(2, anchors.Count);
            })
            .Select(x => x.TrimStart('-', '*', ' ', '\t'))
            .Take(5)
            .ToList();

        return missing.Count == 0
            ? Array.Empty<GenerationCheckItemDto>()
            : new[]
            {
                new GenerationCheckItemDto
                {
                    Code = "locked_fact_missing",
                    Severity = "fatal",
                    Message = $"章节正文未覆盖锁定事实：{string.Join("；", missing)}。",
                    Suggestion = "补写锁定事实或调整章节计划，不要让批量生成跳过硬约束。"
                }
            };
    }

    private static IReadOnlyList<GenerationCheckItemDto> CheckRepeatedParagraphs(string content)
    {
        var repeated = content.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(NormalizeParagraph)
            .Where(x => x.Length >= 12)
            .GroupBy(x => x)
            .Where(x => x.Count() >= 2)
            .Select(x => x.Key)
            .Take(3)
            .ToList();
        return repeated.Count == 0
            ? Array.Empty<GenerationCheckItemDto>()
            : new[]
            {
                new GenerationCheckItemDto
                {
                    Code = "repeated_paragraph",
                    Severity = "warning",
                    Message = $"章节存在重复段落：{string.Join(" / ", repeated.Select(x => x[..Math.Min(28, x.Length)]))}。",
                    Suggestion = "删除重复段落或重写相邻段落，避免 AI 批量生成出现复制感。"
                }
            };
    }

    private static IReadOnlyList<GenerationCheckItemDto> CheckEndingHook(string content)
    {
        if (string.IsNullOrWhiteSpace(content)) return Array.Empty<GenerationCheckItemDto>();
        var tail = content.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .LastOrDefault() ?? content.Trim();
        tail = tail.Length <= 180 ? tail : tail[^180..];
        var hookSignals = new[] { "？", "?", "！", "!", "却", "忽然", "突然", "没想到", "下一刻", "真相", "门后", "声音", "来不及", "出现", "发现" };
        if (hookSignals.Any(signal => tail.Contains(signal, StringComparison.OrdinalIgnoreCase)))
        {
            return Array.Empty<GenerationCheckItemDto>();
        }

        return new[]
        {
            new GenerationCheckItemDto
            {
                Code = "ending_hook_missing",
                Severity = "warning",
                Message = "章末缺少明显悬念、反差或新信息钩子。",
                Suggestion = "增强最后一段，让读者获得下一章追读理由。"
            }
        };
    }

    private async Task<IReadOnlyList<GenerationCheckItemDto>> CheckForeshadowingPayoffAsync(
        TM.Web.Domain.Entities.Core.Chapter chapter,
        string content,
        CancellationToken ct)
    {
        var sourceBookId = await _db.Projects.AsNoTracking()
            .Where(x => x.Id == chapter.ProjectId)
            .Select(x => x.CurrentSourceBookId)
            .FirstOrDefaultAsync(ct);
        var foreshadowings = await _db.Foreshadowings.AsNoTracking()
            .Where(x => x.ProjectId == chapter.ProjectId && !x.IsResolved)
            .Where(x => string.IsNullOrWhiteSpace(sourceBookId) || x.SourceBookId == sourceBookId)
            .ToListAsync(ct);

        var missing = foreshadowings
            .Where(x => IsExpectedChapter(x.ExpectedPayoffChapter, chapter.ChapterNumber))
            .Where(x =>
            {
                var anchors = ExtractAnchors(new[] { x.Name, x.OverdueSuggestion }).Take(6).ToList();
                return anchors.Count > 0 && anchors.Count(anchor => ContainsLoose(content, anchor)) == 0;
            })
            .Take(5)
            .ToList();

        return missing.Count == 0
            ? Array.Empty<GenerationCheckItemDto>()
            : new[]
            {
                new GenerationCheckItemDto
                {
                    Code = "planned_foreshadowing_payoff_missing",
                    Severity = "fatal",
                    Message = $"本章计划回收伏笔但正文未覆盖：{string.Join("、", missing.Select(x => x.Name))}。",
                    Suggestion = "补写伏笔回收动作，或调整伏笔预计回收章节后再继续批量生成。"
                }
            };
    }

    private async Task ApplyTrackingUpdatesAsync(
        TM.Web.Domain.Entities.Core.Chapter chapter,
        string content,
        string summary,
        CancellationToken ct)
    {
        var sourceBookId = await _db.Projects.AsNoTracking()
            .Where(x => x.Id == chapter.ProjectId)
            .Select(x => x.CurrentSourceBookId)
            .FirstOrDefaultAsync(ct);
        var foreshadowings = await _db.Foreshadowings
            .Where(x => x.ProjectId == chapter.ProjectId)
            .Where(x => string.IsNullOrWhiteSpace(sourceBookId) || x.SourceBookId == sourceBookId)
            .ToListAsync(ct);

        foreach (var item in foreshadowings)
        {
            var anchors = ExtractAnchors(new[] { item.Name }).Take(4).ToList();
            var matched = anchors.Count > 0 && anchors.Any(anchor => ContainsLoose(content, anchor));
            if (matched && IsExpectedChapter(item.ExpectedSetupChapter, chapter.ChapterNumber))
            {
                item.IsSetup = true;
                item.ActualSetupChapter = $"第{chapter.ChapterNumber}章";
                item.UpdatedAt = DateTime.UtcNow;
            }

            if (matched && IsExpectedChapter(item.ExpectedPayoffChapter, chapter.ChapterNumber))
            {
                item.IsResolved = true;
                item.IsOverdue = false;
                item.ActualPayoffChapter = $"第{chapter.ChapterNumber}章";
                item.UpdatedAt = DateTime.UtcNow;
            }

            if (!item.IsResolved && IsPastExpectedChapter(item.ExpectedPayoffChapter, chapter.ChapterNumber))
            {
                item.IsOverdue = true;
                if (string.IsNullOrWhiteSpace(item.OverdueSuggestion))
                {
                    item.OverdueSuggestion = "批量生成检测到该伏笔已超过预计回收章节，请尽快回收或调整计划。";
                }
                item.UpdatedAt = DateTime.UtcNow;
            }
        }

        if (!await _db.ChapterTimelines.AnyAsync(x => x.ProjectId == chapter.ProjectId && x.ChapterId == chapter.Id, ct))
        {
            _db.ChapterTimelines.Add(new ChapterTimeline
            {
                ProjectId = chapter.ProjectId,
                ChapterId = chapter.Id,
                SourceBookId = sourceBookId,
                TimePeriod = $"第{chapter.ChapterNumber}章",
                ElapsedTime = string.Empty,
                KeyTimeEvent = FirstNonEmpty(summary, chapter.Summary, chapter.Title),
                Importance = chapter.ChapterNumber == 1 ? "high" : "normal"
            });
        }
    }

    private static IReadOnlyList<string> ExtractAnchors(IEnumerable<string?> values)
    {
        var text = string.Join(" ", values.Where(x => !string.IsNullOrWhiteSpace(x)));
        if (string.IsNullOrWhiteSpace(text)) return Array.Empty<string>();

        var matches = Regex.Matches(text, @"[\p{IsCJKUnifiedIdeographs}]{2,12}|[A-Za-z0-9_-]{2,32}");
        return matches
            .Select(x => x.Value.Trim())
            .Where(x => x.Length >= 2 && !StopWords.Contains(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static string ExtractTaggedValue(string? value, string tag)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var parts = value.Split('；', ';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var prefix = $"{tag}：";
        return parts.FirstOrDefault(x => x.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))?[prefix.Length..].Trim() ?? string.Empty;
    }

    private static bool IsGrounded(string content, string expected)
    {
        if (string.IsNullOrWhiteSpace(expected)) return true;
        if (ContainsLoose(content, expected)) return true;

        var anchors = ExtractAnchors(new[] { expected }).Take(6).ToList();
        if (anchors.Count == 0) return true;
        return anchors.Count(anchor => ContainsLoose(content, anchor)) >= Math.Min(2, anchors.Count);
    }

    private static bool ContainsLoose(string content, string anchor)
    {
        if (string.IsNullOrWhiteSpace(anchor)) return false;
        if (content.Contains(anchor, StringComparison.OrdinalIgnoreCase)) return true;

        var normalizedContent = NormalizeForLooseMatch(content);
        var normalizedAnchor = NormalizeForLooseMatch(anchor);
        if (normalizedAnchor.Length == 0) return false;
        if (normalizedContent.Contains(normalizedAnchor, StringComparison.OrdinalIgnoreCase)) return true;

        var cjkChars = normalizedAnchor.Where(IsCjk).ToArray();
        if (cjkChars.Length < 4) return false;

        var fragments = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < cjkChars.Length - 1; i++)
        {
            var fragment = new string(cjkChars.Skip(i).Take(2).ToArray());
            if (!StopWords.Contains(fragment))
            {
                fragments.Add(fragment);
            }
        }

        if (fragments.Count == 0) return false;
        var hits = fragments.Count(fragment => normalizedContent.Contains(fragment, StringComparison.OrdinalIgnoreCase));
        return hits >= Math.Min(2, fragments.Count);
    }

    private static string NormalizeForLooseMatch(string value)
        => new(value.Where(c => !char.IsWhiteSpace(c) && !char.IsPunctuation(c) && !char.IsSymbol(c)).ToArray());

    private static bool IsCjk(char value)
        => value >= '\u4e00' && value <= '\u9fff';

    private static string NormalizeParagraph(string value)
        => new(value.Where(c => !char.IsWhiteSpace(c)).ToArray());

    private static string NormalizeTitle(string value)
        => new(value.Where(c => !char.IsWhiteSpace(c) && c != '《' && c != '》').ToArray());

    private static string FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim() ?? string.Empty;

    private static bool IsExpectedChapter(string? value, int chapterNumber)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        var normalized = value.Trim();
        return normalized.Contains(chapterNumber.ToString(), StringComparison.Ordinal)
               || normalized.Contains($"第{chapterNumber}章", StringComparison.Ordinal);
    }

    private static bool IsPastExpectedChapter(string? value, int chapterNumber)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        var match = Regex.Match(value, @"\d+");
        return match.Success && int.TryParse(match.Value, out var expected) && chapterNumber > expected;
    }

    private static string BuildSummary(string content, string title)
    {
        var text = string.IsNullOrWhiteSpace(content) ? title : content.Trim();
        text = text.Replace("\r", string.Empty).Replace("\n", " ");
        return text.Length <= 180 ? text : text[..180];
    }

    private static int CountWords(string? content)
        => string.IsNullOrWhiteSpace(content) ? 0 : content.Count(c => !char.IsWhiteSpace(c));

    private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "进入",
        "发现",
        "没有",
        "必须",
        "锁定",
        "事实",
        "不可",
        "改写",
        "章节",
        "场景",
        "正文",
        "信息",
        "主角"
    };

    private static readonly HashSet<string> SceneTitleSuffixStopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "入场",
        "交锋",
        "钩子",
        "开场",
        "收束",
        "承接",
        "转折"
    };
}
