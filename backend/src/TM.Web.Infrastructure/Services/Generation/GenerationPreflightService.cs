using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Domain.Entities.Runtime;
using TM.Web.Domain.Entities.Tracking;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Generation;

public sealed class GenerationPreflightService : IGenerationPreflightService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly AppDbContext _db;

    public GenerationPreflightService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<GenerationPreflightResult> CheckAsync(GenerationPreflightRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.ProjectId))
        {
            throw new ArgumentException("ProjectId 不能为空。", nameof(request.ProjectId));
        }

        var items = new List<GenerationCheckItemDto>();
        var projectExists = await _db.Projects.AsNoTracking().AnyAsync(x => x.Id == request.ProjectId, ct);
        if (!projectExists)
        {
            items.Add(Fatal("missing_project", "项目不存在，无法开始生成。", "先在项目列表选择或创建项目。"));
        }

        ChapterSnapshot? chapter = null;
        if (!string.IsNullOrWhiteSpace(request.ChapterId))
        {
            chapter = await _db.Chapters.AsNoTracking()
                .Where(x => x.Id == request.ChapterId && x.ProjectId == request.ProjectId)
                .Select(x => new ChapterSnapshot(x.Id, x.ProjectId, x.VolumeId, x.ChapterNumber, x.Title))
                .FirstOrDefaultAsync(ct);

            if (chapter == null)
            {
                items.Add(Fatal("missing_chapter", "目标章节不存在，无法生成正文。", "先创建章节，或重新选择章节。"));
            }
        }
        else
        {
            items.Add(Fatal("missing_chapter", "未选择目标章节。", "先选择一个章节再生成。"));
        }

        if (!string.IsNullOrWhiteSpace(request.VolumeId))
        {
            var volumeExists = await _db.Volumes.AsNoTracking()
                .AnyAsync(x => x.Id == request.VolumeId && x.ProjectId == request.ProjectId, ct);
            if (!volumeExists)
            {
                items.Add(Fatal("missing_volume", "目标分卷不存在。", "先选择正确分卷。"));
            }
        }

        if (chapter != null && request.RequireChapterPlan)
        {
            var hasPlan = await _db.ChapterPlans.AsNoTracking()
                .AnyAsync(x => x.ChapterNumber == chapter.ChapterNumber, ct);
            if (!hasPlan)
            {
                items.Add(Fatal("missing_chapter_plan", $"第 {chapter.ChapterNumber} 章缺少章节计划。", "先在章节计划页生成或补齐计划。"));
            }
        }

        if (chapter != null && request.RequireSceneBlueprints)
        {
            var sceneCount = await _db.ChapterBlueprints.AsNoTracking()
                .CountAsync(x => x.ChapterId == chapter.Id, ct);
            if (sceneCount == 0)
            {
                items.Add(Fatal("missing_scene_blueprints", $"第 {chapter.ChapterNumber} 章缺少章节蓝图/场景卡。", "先生成章节蓝图，再按场景生成正文。"));
            }
        }

        var fatalCount = items.Count(x => x.Severity == "fatal");
        var warningCount = items.Count(x => x.Severity == "warning");
        var report = new GenerationPreflightReport
        {
            ProjectId = request.ProjectId,
            VolumeId = request.VolumeId,
            ChapterId = request.ChapterId,
            Passed = fatalCount == 0,
            FatalCount = fatalCount,
            WarningCount = warningCount,
            ItemsJson = JsonSerializer.Serialize(items, JsonOptions)
        };
        _db.GenerationPreflightReports.Add(report);
        await _db.SaveChangesAsync(ct);

        return new GenerationPreflightResult
        {
            Id = report.Id,
            ProjectId = report.ProjectId,
            VolumeId = report.VolumeId,
            ChapterId = report.ChapterId,
            Passed = report.Passed,
            FatalCount = report.FatalCount,
            WarningCount = report.WarningCount,
            Items = items,
            CreatedAt = report.CreatedAt
        };
    }

    public async Task<EnsureSceneBlueprintsResult> EnsureSceneBlueprintsAsync(
        EnsureSceneBlueprintsRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.ProjectId)) throw new InvalidOperationException("项目 ID 不能为空。");
        if (string.IsNullOrWhiteSpace(request.ChapterId)) throw new InvalidOperationException("章节 ID 不能为空。");

        var chapter = await _db.Chapters.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.ChapterId && x.ProjectId == request.ProjectId, ct)
            ?? throw new InvalidOperationException("章节不存在或不属于当前项目。");
        var project = await _db.Projects.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.ProjectId, ct)
            ?? throw new InvalidOperationException("项目不存在。");
        var existing = await _db.ChapterBlueprints.AsNoTracking()
            .Where(x => x.ChapterId == chapter.Id)
            .OrderBy(x => x.SceneNumber)
            .ToListAsync(ct);
        if (existing.Count > 0)
        {
            return new EnsureSceneBlueprintsResult
            {
                ProjectId = request.ProjectId,
                ChapterId = request.ChapterId,
                ExistingCount = existing.Count,
                Scenes = existing.Select(ToScenePreview).ToList()
            };
        }

        var chapterPlan = await _db.ChapterPlans.AsNoTracking()
            .Where(x => x.ChapterNumber == chapter.ChapterNumber)
            .OrderByDescending(x => x.UpdatedAt)
            .FirstOrDefaultAsync(ct);
        var scenes = BuildDefaultScenes(chapter, chapterPlan);
        foreach (var scene in scenes)
        {
            var sceneSummary = FirstNonEmpty(scene.Summary, scene.Goal, chapter.Summary);
            _db.ChapterBlueprints.Add(new ChapterBlueprint
            {
                Name = $"{chapter.Title}·{scene.Title}",
                SourceBookId = project.CurrentSourceBookId,
                Category = "预检自动补齐",
                ChapterId = chapter.Id,
                OneLineStructure = sceneSummary,
                PacingCurve = "开场承接 -> 冲突推进 -> 信息增量 -> 钩子收束",
                SceneNumber = scene.SceneNumber,
                SceneTitle = scene.Title,
                EstimatedWordCount = "1200",
                Opening = scene.Goal,
                Development = scene.Conflict,
                Turning = sceneSummary,
                Ending = scene.Hook,
                InfoDrop = BuildSceneInfoDrop(scene, sceneSummary),
                Cast = FirstNonEmpty(BuildSceneCast(scene), string.Join("、", chapterPlan?.ReferencedCharacterNames ?? new())),
                Locations = FirstNonEmpty(scene.LocationAnchor, string.Join("、", chapterPlan?.ReferencedLocationNames ?? new())),
                Factions = string.Join("、", chapterPlan?.ReferencedFactionNames ?? new())
            });
        }

        await _db.SaveChangesAsync(ct);
        return new EnsureSceneBlueprintsResult
        {
            ProjectId = request.ProjectId,
            ChapterId = request.ChapterId,
            CreatedCount = scenes.Count,
            Scenes = scenes
        };
    }

    public async Task<ConfirmChapterGenerationPreviewResult> ConfirmPreviewAsync(
        ConfirmChapterGenerationPreviewRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.ProjectId)) throw new InvalidOperationException("项目 ID 不能为空。");
        if (string.IsNullOrWhiteSpace(request.ChapterId)) throw new InvalidOperationException("章节 ID 不能为空。");

        var chapter = await _db.Chapters
            .FirstOrDefaultAsync(x => x.Id == request.ChapterId && x.ProjectId == request.ProjectId, ct)
            ?? throw new InvalidOperationException("章节不存在或不属于当前项目。");
        var project = await _db.Projects.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.ProjectId, ct)
            ?? throw new InvalidOperationException("项目不存在。");

        var preview = request.Preview ?? new ChapterBatchGenerationPreviewItemDto();
        var title = FirstNonEmpty(preview.Title, chapter.Title, $"第{chapter.ChapterNumber}章");
        var summary = FirstNonEmpty(preview.Summary, chapter.Summary);
        var scenes = NormalizePreviewScenes(preview, chapter.ChapterNumber, title, summary);
        if (scenes.Count == 0)
        {
            throw new InvalidOperationException("预览里没有可确认的场景蓝图。");
        }

        chapter.Title = title;
        chapter.Summary = summary;
        chapter.Status = chapter.WordCount > 0 ? chapter.Status : "blueprinted";
        chapter.UpdatedAt = DateTime.UtcNow;

        var existing = await _db.ChapterBlueprints
            .Where(x => x.ChapterId == chapter.Id)
            .ToListAsync(ct);
        foreach (var scene in scenes)
        {
            var sceneTitle = FirstNonEmpty(scene.Title, $"场景{scene.SceneNumber}");
            var sceneSummary = FirstNonEmpty(scene.Summary, scene.Goal, summary);
            var infoDrop = BuildSceneInfoDrop(scene, sceneSummary);
            var cast = BuildSceneCast(scene);
            var row = existing.FirstOrDefault(x => x.SceneNumber == scene.SceneNumber);
            if (row is null)
            {
                _db.ChapterBlueprints.Add(new ChapterBlueprint
                {
                    Name = $"{title}·{sceneTitle}",
                    SourceBookId = project.CurrentSourceBookId,
                    Category = "闭环确认",
                    ChapterId = chapter.Id,
                    OneLineStructure = sceneSummary,
                    PacingCurve = "开场承接 -> 冲突推进 -> 信息增量 -> 钩子收束",
                    SceneNumber = scene.SceneNumber,
                    SceneTitle = sceneTitle,
                    EstimatedWordCount = ResolveSceneEstimatedWordCount(scenes.Count),
                    Opening = scene.Goal,
                    Development = scene.Conflict,
                    Turning = sceneSummary,
                    Ending = scene.Hook,
                    InfoDrop = infoDrop,
                    Cast = cast,
                    Locations = scene.LocationAnchor
                });
                continue;
            }

            row.Name = string.IsNullOrWhiteSpace(row.Name) ? $"{title}·{sceneTitle}" : row.Name;
            row.SourceBookId ??= project.CurrentSourceBookId;
            row.Category = string.IsNullOrWhiteSpace(row.Category) ? "闭环确认" : row.Category;
            row.SceneTitle = sceneTitle;
            row.OneLineStructure = sceneSummary;
            row.Opening = FirstNonEmpty(scene.Goal, row.Opening);
            row.Development = FirstNonEmpty(scene.Conflict, row.Development);
            row.Turning = sceneSummary;
            row.Ending = FirstNonEmpty(scene.Hook, row.Ending);
            row.InfoDrop = infoDrop;
            if (string.IsNullOrWhiteSpace(row.Cast)) row.Cast = cast;
            if (string.IsNullOrWhiteSpace(row.Locations)) row.Locations = scene.LocationAnchor;
            row.UpdatedAt = DateTime.UtcNow;
        }

        await UpsertPreviewTrackingAsync(chapter, project.CurrentSourceBookId, scenes, summary, ct);
        await _db.SaveChangesAsync(ct);
        return new ConfirmChapterGenerationPreviewResult
        {
            ProjectId = request.ProjectId,
            ChapterId = request.ChapterId,
            Title = chapter.Title,
            Summary = chapter.Summary,
            SceneCount = scenes.Count,
            Scenes = scenes
        };
    }

    private static GenerationCheckItemDto Fatal(string code, string message, string suggestion)
        => new() { Code = code, Severity = "fatal", Message = message, Suggestion = suggestion };

    private static ChapterBatchGenerationScenePreviewDto ToScenePreview(ChapterBlueprint blueprint)
        => new()
        {
            SceneNumber = blueprint.SceneNumber,
            Title = FirstNonEmpty(blueprint.SceneTitle, blueprint.Name, $"场景{blueprint.SceneNumber}"),
            Summary = FirstNonEmpty(blueprint.OneLineStructure, blueprint.InfoDrop, blueprint.Opening),
            Goal = FirstNonEmpty(blueprint.Opening, blueprint.OneLineStructure),
            Conflict = FirstNonEmpty(blueprint.Development, blueprint.Turning),
            Hook = FirstNonEmpty(blueprint.Ending, blueprint.InfoDrop),
            ForeshadowingName = ExtractTaggedValue(blueprint.Cast, "伏笔"),
            ForeshadowingRole = ExtractTaggedValue(blueprint.Cast, "职责"),
            TimeAnchor = ExtractTaggedValue(blueprint.InfoDrop, "时间"),
            LocationAnchor = FirstNonEmpty(blueprint.Locations, ExtractTaggedValue(blueprint.InfoDrop, "地点")),
            ElapsedFromPrevious = ExtractTaggedValue(blueprint.InfoDrop, "经过"),
            TimelineEffect = ExtractTaggedValue(blueprint.InfoDrop, "时间线")
        };

    private static List<ChapterBatchGenerationScenePreviewDto> BuildDefaultScenes(
        TM.Web.Domain.Entities.Core.Chapter chapter,
        ChapterPlan? chapterPlan)
    {
        var title = FirstNonEmpty(CleanChapterTitle(chapter.Title, chapter.ChapterNumber), chapter.Title, $"第{chapter.ChapterNumber}章");
        var mainGoal = FirstNonEmpty(chapterPlan?.MainGoal, chapter.Summary, "推进本章目标");
        var conflict = FirstNonEmpty(chapterPlan?.ResistanceSource, chapterPlan?.CoreEvent, "遭遇关键阻力");
        var turn = FirstNonEmpty(chapterPlan?.KeyTurn, chapterPlan?.MainPlotProgress, "局势发生变化");
        var hook = FirstNonEmpty(chapterPlan?.Hook, "留下下一章钩子");
        var foreshadowingName = FirstNonEmpty(chapterPlan?.Foreshadowing, hook);
        var foreshadowingRole = FirstNonEmpty(chapterPlan?.ForeshadowingRole, "推进");
        var timeAnchor = FirstNonEmpty(chapterPlan?.TemporalAnchor, chapterPlan?.TimelineCoordinate, $"第{chapter.ChapterNumber}章");
        var locationAnchor = FirstNonEmpty(chapterPlan?.SpatialAnchor, "当前场景地点");
        var timelineEffect = FirstNonEmpty(chapterPlan?.TimelineCoordinate, chapterPlan?.MainPlotProgress, chapter.Summary, "推进本章时间线");
        return new()
        {
            new ChapterBatchGenerationScenePreviewDto
            {
                SceneNumber = 1,
                Title = $"{title}·入场",
                Summary = $"承接上一章，明确本章目标：{mainGoal}",
                Goal = mainGoal,
                Conflict = "旧问题尚未解决，新压力开始逼近。",
                Hook = "角色被迫进入本章核心事件。",
                ForeshadowingName = foreshadowingName,
                ForeshadowingRole = foreshadowingRole == "回收" ? "推进" : foreshadowingRole,
                TimeAnchor = timeAnchor,
                LocationAnchor = locationAnchor,
                ElapsedFromPrevious = "承接上一章",
                TimelineEffect = timelineEffect
            },
            new ChapterBatchGenerationScenePreviewDto
            {
                SceneNumber = 2,
                Title = $"{title}·交锋",
                Summary = $"围绕“{conflict}”展开行动和对抗。",
                Goal = "推进核心事件并制造信息增量。",
                Conflict = conflict,
                Hook = turn,
                ForeshadowingName = foreshadowingName,
                ForeshadowingRole = foreshadowingRole,
                TimeAnchor = timeAnchor,
                LocationAnchor = locationAnchor,
                ElapsedFromPrevious = "本章中段",
                TimelineEffect = timelineEffect
            },
            new ChapterBatchGenerationScenePreviewDto
            {
                SceneNumber = 3,
                Title = $"{title}·钩子",
                Summary = $"完成本章转折并抛出后续追读点：{hook}",
                Goal = "收束本章成果并改变局面。",
                Conflict = FirstNonEmpty(turn, conflict),
                Hook = hook,
                ForeshadowingName = foreshadowingName,
                ForeshadowingRole = foreshadowingRole == "埋设" ? "推进" : foreshadowingRole,
                TimeAnchor = timeAnchor,
                LocationAnchor = locationAnchor,
                ElapsedFromPrevious = "本章末段",
                TimelineEffect = timelineEffect
            }
        };
    }

    private static List<ChapterBatchGenerationScenePreviewDto> NormalizePreviewScenes(
        ChapterBatchGenerationPreviewItemDto preview,
        int chapterNumber,
        string title,
        string summary)
    {
        var scenes = preview.Scenes
            .Where(x => x.SceneNumber > 0 || !string.IsNullOrWhiteSpace(x.Title) || !string.IsNullOrWhiteSpace(x.Summary))
            .Select((x, index) => new ChapterBatchGenerationScenePreviewDto
            {
                SceneNumber = x.SceneNumber > 0 ? x.SceneNumber : index + 1,
                Title = x.Title?.Trim() ?? string.Empty,
                Summary = x.Summary?.Trim() ?? string.Empty,
                Goal = x.Goal?.Trim() ?? string.Empty,
                Conflict = x.Conflict?.Trim() ?? string.Empty,
                Hook = x.Hook?.Trim() ?? string.Empty,
                ForeshadowingName = x.ForeshadowingName?.Trim() ?? string.Empty,
                ForeshadowingRole = x.ForeshadowingRole?.Trim() ?? string.Empty,
                TimeAnchor = x.TimeAnchor?.Trim() ?? string.Empty,
                LocationAnchor = x.LocationAnchor?.Trim() ?? string.Empty,
                ElapsedFromPrevious = x.ElapsedFromPrevious?.Trim() ?? string.Empty,
                TimelineEffect = x.TimelineEffect?.Trim() ?? string.Empty
            })
            .OrderBy(x => x.SceneNumber)
            .ToList();

        if (scenes.Count > 0)
        {
            return scenes;
        }

        var baseTitle = FirstNonEmpty(CleanChapterTitle(title, chapterNumber), title, $"第{chapterNumber}章");
        return new()
        {
            new ChapterBatchGenerationScenePreviewDto
            {
                SceneNumber = 1,
                Title = $"{baseTitle}·入场",
                Summary = $"承接上一章，明确本章目标：{FirstNonEmpty(summary, "推进本章目标")}",
                Goal = FirstNonEmpty(summary, "推进本章目标"),
                Conflict = "旧问题尚未解决，新压力开始逼近。",
                Hook = "角色被迫进入本章核心事件。"
            },
            new ChapterBatchGenerationScenePreviewDto
            {
                SceneNumber = 2,
                Title = $"{baseTitle}·交锋",
                Summary = "推进核心事件并制造信息增量。",
                Goal = "推进核心事件并制造信息增量。",
                Conflict = "遭遇关键阻力。",
                Hook = "局势发生变化。"
            },
            new ChapterBatchGenerationScenePreviewDto
            {
                SceneNumber = 3,
                Title = $"{baseTitle}·钩子",
                Summary = "收束本章成果并改变局面。",
                Goal = "收束本章成果并改变局面。",
                Conflict = "转折后的新问题浮出水面。",
                Hook = "留下下一章钩子。"
            }
        };
    }

    private static string ResolveSceneEstimatedWordCount(int sceneCount)
        => $"{Math.Max(800, 4000 / Math.Max(1, sceneCount))}";

    private async Task UpsertPreviewTrackingAsync(
        TM.Web.Domain.Entities.Core.Chapter chapter,
        string? sourceBookId,
        IReadOnlyList<ChapterBatchGenerationScenePreviewDto> scenes,
        string? summary,
        CancellationToken ct)
    {
        var foreshadowingScenes = scenes
            .Where(x => !string.IsNullOrWhiteSpace(x.ForeshadowingName))
            .GroupBy(x => x.ForeshadowingName.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(x => x.First())
            .ToList();

        foreach (var scene in foreshadowingScenes)
        {
            var name = scene.ForeshadowingName.Trim();
            var row = await _db.Foreshadowings.FirstOrDefaultAsync(x =>
                x.ProjectId == chapter.ProjectId
                && x.SourceBookId == sourceBookId
                && x.Name == name, ct);
            if (row is null)
            {
                row = new Foreshadowing
                {
                    ProjectId = chapter.ProjectId,
                    SourceBookId = sourceBookId,
                    Name = name,
                    Tier = "Tier-2"
                };
                _db.Foreshadowings.Add(row);
            }

            if (scene.ForeshadowingRole.Contains("埋设", StringComparison.OrdinalIgnoreCase))
            {
                row.IsSetup = true;
                row.ActualSetupChapter = $"第{chapter.ChapterNumber}章";
                if (string.IsNullOrWhiteSpace(row.ExpectedSetupChapter)) row.ExpectedSetupChapter = $"第{chapter.ChapterNumber}章";
            }

            if (scene.ForeshadowingRole.Contains("回收", StringComparison.OrdinalIgnoreCase))
            {
                row.IsResolved = true;
                row.IsOverdue = false;
                row.ActualPayoffChapter = $"第{chapter.ChapterNumber}章";
                if (string.IsNullOrWhiteSpace(row.ExpectedPayoffChapter)) row.ExpectedPayoffChapter = $"第{chapter.ChapterNumber}章";
            }

            if (string.IsNullOrWhiteSpace(row.OverdueSuggestion))
            {
                row.OverdueSuggestion = "由章节场景预览自动创建，请在叙事追踪中确认回收计划。";
            }

            row.UpdatedAt = DateTime.UtcNow;
        }

        var timelineScene = scenes.FirstOrDefault(x =>
            !string.IsNullOrWhiteSpace(x.TimeAnchor)
            || !string.IsNullOrWhiteSpace(x.TimelineEffect));
        if (timelineScene is null) return;

        var timeline = await _db.ChapterTimelines.FirstOrDefaultAsync(x =>
            x.ProjectId == chapter.ProjectId
            && x.ChapterId == chapter.Id
            && x.SourceBookId == sourceBookId, ct);
        if (timeline is null)
        {
            _db.ChapterTimelines.Add(new ChapterTimeline
            {
                ProjectId = chapter.ProjectId,
                ChapterId = chapter.Id,
                SourceBookId = sourceBookId,
                TimePeriod = FirstNonEmpty(timelineScene.TimeAnchor, $"第{chapter.ChapterNumber}章"),
                ElapsedTime = timelineScene.ElapsedFromPrevious,
                KeyTimeEvent = FirstNonEmpty(timelineScene.TimelineEffect, summary, chapter.Summary, chapter.Title),
                Importance = "normal"
            });
            return;
        }

        if (string.IsNullOrWhiteSpace(timeline.TimePeriod)) timeline.TimePeriod = timelineScene.TimeAnchor;
        if (string.IsNullOrWhiteSpace(timeline.ElapsedTime)) timeline.ElapsedTime = timelineScene.ElapsedFromPrevious;
        if (string.IsNullOrWhiteSpace(timeline.KeyTimeEvent)) timeline.KeyTimeEvent = FirstNonEmpty(timelineScene.TimelineEffect, summary, chapter.Summary, chapter.Title);
        timeline.UpdatedAt = DateTime.UtcNow;
    }

    private static string BuildSceneInfoDrop(ChapterBatchGenerationScenePreviewDto scene, string summary)
        => string.Join("；", new[]
        {
            summary,
            string.IsNullOrWhiteSpace(scene.TimeAnchor) ? string.Empty : $"时间：{scene.TimeAnchor}",
            string.IsNullOrWhiteSpace(scene.LocationAnchor) ? string.Empty : $"地点：{scene.LocationAnchor}",
            string.IsNullOrWhiteSpace(scene.ElapsedFromPrevious) ? string.Empty : $"经过：{scene.ElapsedFromPrevious}",
            string.IsNullOrWhiteSpace(scene.TimelineEffect) ? string.Empty : $"时间线：{scene.TimelineEffect}"
        }.Where(x => !string.IsNullOrWhiteSpace(x)));

    private static string BuildSceneCast(ChapterBatchGenerationScenePreviewDto scene)
        => string.Join("；", new[]
        {
            string.IsNullOrWhiteSpace(scene.ForeshadowingName) ? string.Empty : $"伏笔：{scene.ForeshadowingName}",
            string.IsNullOrWhiteSpace(scene.ForeshadowingRole) ? string.Empty : $"职责：{scene.ForeshadowingRole}"
        }.Where(x => !string.IsNullOrWhiteSpace(x)));

    private static string ExtractTaggedValue(string? value, string tag)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var parts = value.Split('；', ';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var prefix = $"{tag}：";
        return parts.FirstOrDefault(x => x.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))?[prefix.Length..].Trim() ?? string.Empty;
    }

    private static string CleanChapterTitle(string? title, int chapterNumber)
    {
        if (string.IsNullOrWhiteSpace(title)) return string.Empty;
        var trimmed = title.Trim();
        var prefix = $"第{chapterNumber}章";
        return trimmed.StartsWith(prefix, StringComparison.Ordinal)
            ? trimmed[prefix.Length..].Trim(' ', '\t', '：', ':', '-', '－', '—', '_')
            : trimmed;
    }

    private static string FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim() ?? string.Empty;

    private sealed record ChapterSnapshot(string Id, string ProjectId, string VolumeId, int ChapterNumber, string Title);
}
