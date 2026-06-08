using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Core;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Domain.Entities.Global;
using TM.Web.Domain.Entities.Tracking;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Generation;

public sealed class ChapterBatchGenerationWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IChapterBatchGenerationJobQueue _queue;
    private readonly ILogger<ChapterBatchGenerationWorker> _logger;

    public ChapterBatchGenerationWorker(
        IServiceScopeFactory scopeFactory,
        IChapterBatchGenerationJobQueue queue,
        ILogger<ChapterBatchGenerationWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _queue = queue;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var job = await _queue.DequeueAsync(stoppingToken);
            try
            {
                await ProcessJobAsync(job, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Chapter batch generation job failed. JobId={JobId}", job.JobId);
                await using var scope = _scopeFactory.CreateAsyncScope();
                if (scope.ServiceProvider.GetRequiredService<IChapterBatchGenerationService>() is ChapterBatchGenerationService service
                    && service.TryGetState(job.JobId) is { } state)
                {
                    state.AddFailed(0, "后台任务", BuildFailureMessage(ex));
                    state.MarkCompleted();
                    PersistState(service, state, state.Message, "error");
                }
            }
        }
    }

    private async Task ProcessJobAsync(ChapterBatchGenerationJob job, CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        if (scope.ServiceProvider.GetRequiredService<IChapterBatchGenerationService>() is not ChapterBatchGenerationService service
            || service.TryGetState(job.JobId) is not { } state)
        {
            return;
        }

        state.MarkRunning();

        var chapters = scope.ServiceProvider.GetRequiredService<IChapterService>();
        var drafts = scope.ServiceProvider.GetRequiredService<IChapterDraftService>();
        var analysis = scope.ServiceProvider.GetRequiredService<IChapterAnalysisService>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        PersistState(service, state, "后台章节生成正在运行。");

        for (var offset = 0; offset < job.Request.Count; offset++)
        {
            if (state.CancelRequested)
            {
                break;
            }

            var chapterNumber = job.Request.StartChapterNumber + offset;
            try
            {
                var chapter = await EnsureChapterAsync(chapters, db, job.Request, chapterNumber, state, ct);
                var detail = await chapters.GetAsync(chapter.Id, ct)
                             ?? throw new InvalidOperationException($"章节不存在：{chapter.Id}");

                state.SetCurrent(detail.ChapterNumber, detail.Title);
                PersistState(service, state);

                if (!job.Request.OverwriteExisting && !string.IsNullOrWhiteSpace(detail.Content))
                {
                    state.AddSkipped(detail.ChapterNumber, detail.Title);
                    PersistState(service, state, $"已跳过第 {detail.ChapterNumber} 章：{detail.Title}，已有正文。");
                    continue;
                }

                await drafts.GenerateDraftAsync(BuildDraftRequest(job, detail), ct);
                var analysisResult = await analysis.AnalyzeAsync(new ChapterAnalysisRequest
                {
                    ProjectId = job.Request.ProjectId,
                    ChapterId = detail.Id,
                    MinWordCount = ResolveMinWordCount(job.Request),
                    MaxDuplicateTitleWindow = 5,
                    UpdateChapterSummary = true
                }, ct);
                if (analysisResult.ShouldPauseBatch)
                {
                    var reason = analysisResult.Items.FirstOrDefault()?.Message ?? "章节分析未通过。";
                    state.AddFailed(detail.ChapterNumber, detail.Title, $"章节分析触发暂停：{reason}");
                    PersistState(service, state, $"章节分析触发暂停：{reason}", "warning");
                    break;
                }

                state.AddCompleted(detail.ChapterNumber, detail.Title);
                PersistState(service, state, $"已生成第 {detail.ChapterNumber} 章：{detail.Title}");
            }
            catch (Exception ex)
            {
                var title = await FindChapterTitleAsync(db, job.Request, chapterNumber, ct);
                state.AddFailed(chapterNumber, title, BuildFailureMessage(ex));
                PersistState(service, state, $"第 {chapterNumber} 章失败：{title}。{BuildFailureMessage(ex)}", "error");
                if (job.Request.StopOnFailure)
                {
                    break;
                }
            }
        }

        state.MarkCompleted();
        PersistState(service, state, state.Message, state.Failed > 0 ? "warning" : "info");
        await PersistNotificationAsync(db, state.ToDto(), ct);
    }

    private static void PersistState(
        ChapterBatchGenerationService service,
        ChapterBatchGenerationJobState state,
        string? logMessage = null,
        string level = "info")
        => service.PersistStatus(state.ToDto(), logMessage, level);

    private static async Task<ChapterDto> EnsureChapterAsync(
        IChapterService chapters,
        AppDbContext db,
        ChapterBatchGenerationRequest request,
        int chapterNumber,
        ChapterBatchGenerationJobState state,
        CancellationToken ct)
    {
        var existing = (await chapters.ListAsync(request.ProjectId, request.VolumeId, ct))
            .FirstOrDefault(x => x.ChapterNumber == chapterNumber);
        if (existing is not null)
        {
            var previewItem = await ResolvePreviewItemAsync(db, request, existing, chapterNumber, ct);
            if (ShouldReplaceChapterTitle(existing.Title, previewItem.Title, chapterNumber)
                || (string.IsNullOrWhiteSpace(existing.Summary) && !string.IsNullOrWhiteSpace(previewItem.Summary)))
            {
                var updated = await chapters.UpdateAsync(existing.Id, new ChapterUpsertDto(
                    existing.ProjectId,
                    existing.VolumeId,
                    existing.ChapterNumber,
                    previewItem.Title,
                    FirstNonEmpty(existing.Summary, previewItem.Summary),
                    string.Empty,
                    existing.Status), ct);
                await UpsertPreviewBlueprintsAsync(db, request, updated, previewItem, ct);
                state.AddLog($"已校正第 {updated.ChapterNumber} 章标题/简介：{updated.Title}");
                return updated;
            }

            await UpsertPreviewBlueprintsAsync(db, request, existing, previewItem, ct);
            return existing;
        }

        if (!request.CreateMissing)
        {
            throw new InvalidOperationException($"第 {chapterNumber} 章不存在，且未启用自动创建。");
        }

        var preview = await ResolvePreviewItemAsync(db, request, null, chapterNumber, ct);
        var created = await chapters.CreateAsync(new ChapterUpsertDto(
            request.ProjectId,
            request.VolumeId,
            chapterNumber,
            preview.Title,
            preview.Summary,
            string.Empty,
            "planned"), ct);
        await UpsertPreviewBlueprintsAsync(db, request, created, preview, ct);
        state.AddCreated(created.ChapterNumber, created.Title);
        return created;
    }

    private static ChapterDraftRequest BuildDraftRequest(ChapterBatchGenerationJob job, ChapterDto chapter)
        => new()
        {
            RunId = $"{job.JobId}_{chapter.ChapterNumber}",
            ProjectId = job.Request.ProjectId,
            VolumeId = job.Request.VolumeId,
            ChapterId = chapter.Id,
            ConfigId = job.Request.ConfigId,
            Endpoint = job.Request.Endpoint,
            ProviderId = job.Request.ProviderId,
            ApiKeyId = job.Request.ApiKeyId,
            ApiKey = job.Request.ApiKey,
            Model = job.Request.Model,
            SystemPrompt = job.Request.SystemPrompt,
            Prompt = BuildPrompt(job.Request, chapter),
            Temperature = job.Request.Temperature,
            MaxTokens = job.Request.MaxTokens,
            MaxRewriteAttempts = job.Request.MaxRewriteAttempts,
            ValidationReportId = job.Request.ValidationReportId,
            RerunValidationAfterSave = job.Request.RerunValidationAfterSave,
            SaveToChapter = true
        };

    private static int ResolveMinWordCount(ChapterBatchGenerationRequest request)
        => request.AutoContinuityMode ? 2500 : 1200;

    private static string BuildPrompt(ChapterBatchGenerationRequest request, ChapterDto chapter)
    {
        var heading = BuildRequiredHeading(chapter);
        return string.Join('\n', new[]
        {
            $"项目：{request.ProjectId}",
            $"卷：{request.VolumeId}",
            $"章节：{chapter.ChapterNumber} / {chapter.Title}",
            $"本章正文标题硬约束：{heading}",
            string.IsNullOrWhiteSpace(chapter.Summary) ? string.Empty : $"摘要：{chapter.Summary}",
            BuildScenePromptSection(request, chapter),
            request.AutoContinuityMode
                ? "自动连续模式已开启：必须承接上一章的角色状态、地点状态、冲突进度、伏笔和时间线；不得重置人物关系，不得跳过上一章钩子。"
                : string.Empty,
            string.Empty,
            "请直接输出章节草稿，保持叙事连贯清晰。",
            $"正文第一行必须严格使用“{heading}”。",
            "不得沿用其他章节标题，不得重复使用“线索展开”“冲突升级”“关键转折”等泛化标题，除非上面的本章正文标题硬约束就是该标题。",
            "章节号与标题是硬约束；本章内容必须围绕当前章节规划展开，不要生成上一章或下一章。"
        }.Where(x => x.Length > 0));
    }

    private static async Task<string> FindChapterTitleAsync(
        AppDbContext db,
        ChapterBatchGenerationRequest request,
        int chapterNumber,
        CancellationToken ct)
        => await db.Chapters.AsNoTracking()
               .Where(x => x.VolumeId == request.VolumeId && x.ChapterNumber == chapterNumber)
               .Select(x => x.Title)
               .FirstOrDefaultAsync(ct)
           ?? await ResolveChapterTitleAsync(db, request, null, chapterNumber, ct);

    public static async Task<IReadOnlyList<ChapterBatchGenerationPreviewItemDto>> BuildPreviewAsync(
        AppDbContext db,
        ChapterBatchGenerationPreviewRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ProjectId)) throw new InvalidOperationException("项目 ID 不能为空。");
        if (string.IsNullOrWhiteSpace(request.VolumeId)) throw new InvalidOperationException("分卷 ID 不能为空。");
        if (request.StartChapterNumber <= 0) throw new InvalidOperationException("起始章节号必须大于 0。");

        request.Count = Math.Clamp(request.Count, 1, 200);
        var batchRequest = new ChapterBatchGenerationRequest
        {
            ProjectId = request.ProjectId,
            VolumeId = request.VolumeId,
            StartChapterNumber = request.StartChapterNumber,
            Count = request.Count,
            CreateMissing = request.CreateMissing
        };

        var existingChapters = await db.Chapters.AsNoTracking()
            .Where(x => x.ProjectId == request.ProjectId && x.VolumeId == request.VolumeId)
            .ToListAsync(ct);

        var items = new List<ChapterBatchGenerationPreviewItemDto>();
        for (var offset = 0; offset < request.Count; offset++)
        {
            var chapterNumber = request.StartChapterNumber + offset;
            var existing = existingChapters.FirstOrDefault(x => x.ChapterNumber == chapterNumber);
            if (existing is null && !request.CreateMissing)
            {
                var fallbackTitle = BuildFallbackChapterTitle(chapterNumber);
                var fallbackSummary = BuildFallbackChapterSummary(chapterNumber, fallbackTitle, "章节不存在，且未启用自动创建。");
                items.Add(new ChapterBatchGenerationPreviewItemDto
                {
                    ChapterNumber = chapterNumber,
                    Title = fallbackTitle,
                    Summary = fallbackSummary,
                    Exists = false,
                    HasContent = false,
                    Source = "missing",
                    Scenes = BuildDefaultPreviewScenes(chapterNumber, fallbackTitle, fallbackSummary)
                });
                continue;
            }

            items.Add(await ResolvePreviewItemAsync(db, batchRequest, existing, chapterNumber, ct));
        }

        return items;
    }

    private static async Task<string> ResolveChapterTitleAsync(
        AppDbContext db,
        ChapterBatchGenerationRequest request,
        ChapterDto? chapter,
        int chapterNumber,
        CancellationToken ct)
        => (await ResolvePreviewItemAsync(db, request, chapter, chapterNumber, ct)).Title;

    private static async Task<ChapterBatchGenerationPreviewItemDto> ResolvePreviewItemAsync(
        AppDbContext db,
        ChapterBatchGenerationRequest request,
        object? chapter,
        int chapterNumber,
        CancellationToken ct)
    {
        var overrideItem = request.PreviewItems
            .FirstOrDefault(x => x.ChapterNumber == chapterNumber);
        if (overrideItem is not null)
        {
            return new ChapterBatchGenerationPreviewItemDto
            {
                ChapterNumber = chapterNumber,
                Title = string.IsNullOrWhiteSpace(overrideItem.Title)
                    ? BuildFallbackChapterTitle(chapterNumber)
                    : overrideItem.Title.Trim(),
                Summary = overrideItem.Summary?.Trim() ?? string.Empty,
                Exists = GetChapterId(chapter) is not null,
                HasContent = ChapterHasContent(chapter),
                Source = "confirmed",
                Scenes = NormalizePreviewScenes(overrideItem, chapterNumber)
            };
        }

        var sourceBookId = await db.Projects.AsNoTracking()
            .Where(p => p.Id == request.ProjectId)
            .Select(p => p.CurrentSourceBookId)
            .FirstOrDefaultAsync(ct);

        var chapterPlan = await FilterBySourceBook(
                db.ChapterPlans.AsNoTracking().Where(x => x.IsEnabled),
                sourceBookId)
            .Where(x => x.ChapterNumber == chapterNumber)
            .OrderByDescending(x => x.UpdatedAt)
            .FirstOrDefaultAsync(ct);

        var plannedTitle = CleanChapterTitle(chapterPlan?.ChapterTitle, chapterNumber);
        if (!string.IsNullOrWhiteSpace(plannedTitle))
        {
            return new ChapterBatchGenerationPreviewItemDto
            {
                ChapterNumber = chapterNumber,
                Title = plannedTitle,
                Summary = FirstNonEmpty(
                    GetChapterSummary(chapter),
                    chapterPlan?.MainPlotProgress,
                    chapterPlan?.MainGoal,
                    chapterPlan?.ChapterTheme,
                    chapterPlan?.ReaderExperienceGoal),
                Exists = GetChapterId(chapter) is not null,
                HasContent = ChapterHasContent(chapter),
                Source = "chapter_plan",
                Scenes = await ResolvePreviewScenesAsync(db, sourceBookId, GetChapterId(chapter), chapterNumber, plannedTitle, chapterPlan, GetChapterSummary(chapter), ct)
            };
        }

        var chapterId = GetChapterId(chapter);
        if (chapter is not null)
        {
            var blueprintTitle = await FilterBySourceBook(
                    db.ChapterBlueprints.AsNoTracking().Where(x => x.IsEnabled),
                    sourceBookId)
                .Where(x => x.ChapterId == chapterId)
                .OrderBy(x => x.SceneNumber)
                .ThenByDescending(x => x.UpdatedAt)
                .Select(x => string.IsNullOrWhiteSpace(x.SceneTitle) ? x.Name : x.SceneTitle)
                .FirstOrDefaultAsync(ct);

            blueprintTitle = CleanChapterTitle(blueprintTitle, chapterNumber);
            if (!string.IsNullOrWhiteSpace(blueprintTitle))
            {
                return new ChapterBatchGenerationPreviewItemDto
                {
                    ChapterNumber = chapterNumber,
                    Title = blueprintTitle,
                    Summary = GetChapterSummary(chapter),
                    Exists = chapterId is not null,
                    HasContent = ChapterHasContent(chapter),
                    Source = "chapter_blueprint",
                    Scenes = await ResolvePreviewScenesAsync(db, sourceBookId, chapterId, chapterNumber, blueprintTitle, chapterPlan: null, GetChapterSummary(chapter), ct)
                };
            }
        }

        var existingTitle = CleanChapterTitle(GetChapterTitle(chapter), chapterNumber);
        if (!string.IsNullOrWhiteSpace(existingTitle))
        {
            return new ChapterBatchGenerationPreviewItemDto
            {
                ChapterNumber = chapterNumber,
                Title = existingTitle,
                Summary = GetChapterSummary(chapter),
                Exists = chapterId is not null,
                HasContent = ChapterHasContent(chapter),
                Source = "chapter",
                Scenes = await ResolvePreviewScenesAsync(db, sourceBookId, chapterId, chapterNumber, existingTitle, chapterPlan: null, GetChapterSummary(chapter), ct)
            };
        }

        var fallbackTitle = BuildFallbackChapterTitle(chapterNumber);
        var fallbackSummary = BuildFallbackChapterSummary(chapterNumber, fallbackTitle);
        return new ChapterBatchGenerationPreviewItemDto
        {
            ChapterNumber = chapterNumber,
            Title = fallbackTitle,
            Summary = fallbackSummary,
            Exists = chapterId is not null,
            HasContent = ChapterHasContent(chapter),
            Source = "fallback",
            Scenes = BuildDefaultPreviewScenes(chapterNumber, fallbackTitle, fallbackSummary)
        };
    }

    private static async Task UpsertPreviewBlueprintsAsync(
        AppDbContext db,
        ChapterBatchGenerationRequest request,
        ChapterDto chapter,
        ChapterBatchGenerationPreviewItemDto preview,
        CancellationToken ct)
    {
        var scenes = NormalizePreviewScenes(preview, chapter.ChapterNumber);
        if (scenes.Count == 0) return;

        var sourceBookId = await db.Projects.AsNoTracking()
            .Where(x => x.Id == request.ProjectId)
            .Select(x => x.CurrentSourceBookId)
            .FirstOrDefaultAsync(ct);
        var existing = await db.ChapterBlueprints
            .Where(x => x.ChapterId == chapter.Id)
            .ToListAsync(ct);

        foreach (var scene in scenes)
        {
            var title = FirstNonEmpty(scene.Title, $"场景{scene.SceneNumber}");
            var summary = FirstNonEmpty(scene.Summary, scene.Goal, preview.Summary);
            var row = existing.FirstOrDefault(x => x.SceneNumber == scene.SceneNumber);
            var infoDrop = BuildSceneInfoDrop(scene, summary);
            var cast = BuildSceneCast(scene);
            if (row is null)
            {
                db.ChapterBlueprints.Add(new ChapterBlueprint
                {
                    Name = $"{preview.Title}·{title}",
                    SourceBookId = sourceBookId,
                    Category = "自动生成预览",
                    ChapterId = chapter.Id,
                    OneLineStructure = summary,
                    PacingCurve = "开场承接 -> 冲突推进 -> 信息增量 -> 钩子收束",
                    SceneNumber = scene.SceneNumber,
                    SceneTitle = title,
                    EstimatedWordCount = ResolveSceneEstimatedWordCount(request, scenes.Count),
                    Opening = scene.Goal,
                    Development = scene.Conflict,
                    Turning = summary,
                    Ending = scene.Hook,
                    InfoDrop = infoDrop,
                    Cast = cast,
                    Locations = scene.LocationAnchor
                });
                continue;
            }

            if (string.IsNullOrWhiteSpace(row.SceneTitle)) row.SceneTitle = title;
            if (string.IsNullOrWhiteSpace(row.OneLineStructure)) row.OneLineStructure = summary;
            if (string.IsNullOrWhiteSpace(row.Opening)) row.Opening = scene.Goal;
            if (string.IsNullOrWhiteSpace(row.Development)) row.Development = scene.Conflict;
            if (string.IsNullOrWhiteSpace(row.Ending)) row.Ending = scene.Hook;
            if (string.IsNullOrWhiteSpace(row.InfoDrop)) row.InfoDrop = infoDrop;
            if (string.IsNullOrWhiteSpace(row.Cast)) row.Cast = cast;
            if (string.IsNullOrWhiteSpace(row.Locations)) row.Locations = scene.LocationAnchor;
            row.UpdatedAt = DateTime.UtcNow;
        }

        await UpsertPreviewTrackingAsync(db, request, chapter, preview, scenes, sourceBookId, ct);
        await db.SaveChangesAsync(ct);
    }

    private static string BuildScenePromptSection(ChapterBatchGenerationRequest request, ChapterDto chapter)
    {
        var preview = request.PreviewItems.FirstOrDefault(x => x.ChapterNumber == chapter.ChapterNumber);
        var scenes = preview is null
            ? BuildDefaultPreviewScenes(chapter.ChapterNumber, chapter.Title, chapter.Summary)
            : NormalizePreviewScenes(preview, chapter.ChapterNumber);
        if (scenes.Count == 0) return string.Empty;

        var lines = scenes
            .OrderBy(x => x.SceneNumber)
            .Select(x => $"场景{x.SceneNumber}《{FirstNonEmpty(x.Title, $"场景{x.SceneNumber}")}》：{FirstNonEmpty(x.Summary, x.Goal)}；目标：{FirstNonEmpty(x.Goal, "推进本章目标")}；冲突：{FirstNonEmpty(x.Conflict, "制造阻力")}；收束钩子：{FirstNonEmpty(x.Hook, "承接下一场景")}；伏笔：{FirstNonEmpty(x.ForeshadowingRole, "无")}《{FirstNonEmpty(x.ForeshadowingName, "无")}》；时间：{FirstNonEmpty(x.TimeAnchor, "承接上一场景")}；地点：{FirstNonEmpty(x.LocationAnchor, "承接上一场景")}；时间推进：{FirstNonEmpty(x.ElapsedFromPrevious, "连续推进")}；时间线影响：{FirstNonEmpty(x.TimelineEffect, "推进本章事件")}");
        return $"本章场景蓝图硬约束：\n{string.Join('\n', lines)}\n正文必须按以上场景顺序推进，不得把所有场景写成同一个事件；不得跳过场景指定伏笔；不得让时间线倒退或地点无故跳跃。";
    }

    private static async Task<List<ChapterBatchGenerationScenePreviewDto>> ResolvePreviewScenesAsync(
        AppDbContext db,
        string? sourceBookId,
        string? chapterId,
        int chapterNumber,
        string title,
        ChapterPlan? chapterPlan,
        string? summary,
        CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(chapterId))
        {
            var blueprints = await FilterBySourceBook(
                    db.ChapterBlueprints.AsNoTracking().Where(x => x.IsEnabled),
                    sourceBookId)
                .Where(x => x.ChapterId == chapterId)
                .OrderBy(x => x.SceneNumber)
                .ThenByDescending(x => x.UpdatedAt)
                .ToListAsync(ct);
            if (blueprints.Count > 0)
            {
                return blueprints
                    .GroupBy(x => x.SceneNumber)
                    .Select(x => x.First())
                    .OrderBy(x => x.SceneNumber)
                    .Select(x => new ChapterBatchGenerationScenePreviewDto
                    {
                        SceneNumber = x.SceneNumber,
                        Title = FirstNonEmpty(x.SceneTitle, x.Name, $"场景{x.SceneNumber}"),
                        Summary = FirstNonEmpty(x.OneLineStructure, x.InfoDrop, x.Opening),
                        Goal = FirstNonEmpty(x.Opening, x.OneLineStructure),
                        Conflict = FirstNonEmpty(x.Development, x.Turning),
                        Hook = FirstNonEmpty(x.Ending, x.InfoDrop),
                        ForeshadowingName = ExtractTaggedValue(x.Cast, "伏笔"),
                        ForeshadowingRole = ExtractTaggedValue(x.Cast, "职责"),
                        TimeAnchor = ExtractTaggedValue(x.InfoDrop, "时间"),
                        LocationAnchor = FirstNonEmpty(x.Locations, ExtractTaggedValue(x.InfoDrop, "地点")),
                        ElapsedFromPrevious = ExtractTaggedValue(x.InfoDrop, "经过"),
                        TimelineEffect = ExtractTaggedValue(x.InfoDrop, "时间线")
                    })
                    .ToList();
            }
        }

        return BuildDefaultPreviewScenes(
            chapterNumber,
            title,
            FirstNonEmpty(summary, chapterPlan?.MainPlotProgress, chapterPlan?.MainGoal, chapterPlan?.CoreEvent),
            chapterPlan);
    }

    private static List<ChapterBatchGenerationScenePreviewDto> NormalizePreviewScenes(
        ChapterBatchGenerationPreviewItemDto item,
        int chapterNumber)
    {
        var scenes = item.Scenes
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

        return scenes.Count > 0
            ? scenes
            : BuildDefaultPreviewScenes(chapterNumber, item.Title, item.Summary);
    }

    private static List<ChapterBatchGenerationScenePreviewDto> BuildDefaultPreviewScenes(
        int chapterNumber,
        string title,
        string summary,
        ChapterPlan? chapterPlan = null)
    {
        var cleanTitle = CleanChapterTitle(title, chapterNumber);
        var baseTitle = FirstNonEmpty(cleanTitle, title, $"第{chapterNumber}章");
        var mainGoal = FirstNonEmpty(chapterPlan?.MainGoal, summary, "推进本章目标");
        var conflict = FirstNonEmpty(chapterPlan?.ResistanceSource, chapterPlan?.CoreEvent, "遭遇关键阻力");
        var turn = FirstNonEmpty(chapterPlan?.KeyTurn, chapterPlan?.MainPlotProgress, "局势发生变化");
        var hook = FirstNonEmpty(chapterPlan?.Hook, "留下下一章钩子");
        var foreshadowingName = FirstNonEmpty(chapterPlan?.Foreshadowing, hook);
        var foreshadowingRole = FirstNonEmpty(chapterPlan?.ForeshadowingRole, "推进");
        var timeAnchor = FirstNonEmpty(chapterPlan?.TemporalAnchor, chapterPlan?.TimelineCoordinate, $"第{chapterNumber}章");
        var locationAnchor = FirstNonEmpty(chapterPlan?.SpatialAnchor, "当前场景地点");
        var timelineEffect = FirstNonEmpty(chapterPlan?.TimelineCoordinate, chapterPlan?.MainPlotProgress, summary, "推进本章时间线");
        return new()
        {
            new ChapterBatchGenerationScenePreviewDto
            {
                SceneNumber = 1,
                Title = $"{baseTitle}·入场",
                Summary = $"承接上一章，明确本章目标：{mainGoal}",
                Goal = mainGoal,
                Conflict = "旧问题尚未解决，新压力开始逼近。",
                Hook = "角色被迫进入本章核心事件。",
                ForeshadowingName = foreshadowingName,
                ForeshadowingRole = foreshadowingRole == "回收" ? "推进" : FirstNonEmpty(foreshadowingRole, "埋设"),
                TimeAnchor = timeAnchor,
                LocationAnchor = locationAnchor,
                ElapsedFromPrevious = "承接上一章",
                TimelineEffect = timelineEffect
            },
            new ChapterBatchGenerationScenePreviewDto
            {
                SceneNumber = 2,
                Title = $"{baseTitle}·交锋",
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
                Title = $"{baseTitle}·钩子",
                Summary = $"完成本章转折并抛出后续追读点：{hook}",
                Goal = "收束本章成果并改变局面。",
                Conflict = FirstNonEmpty(turn, conflict),
                Hook = hook,
                ForeshadowingName = foreshadowingName,
                ForeshadowingRole = foreshadowingRole == "埋设" ? "推进" : FirstNonEmpty(foreshadowingRole, "推进"),
                TimeAnchor = timeAnchor,
                LocationAnchor = locationAnchor,
                ElapsedFromPrevious = "本章末段",
                TimelineEffect = timelineEffect
            }
        };
    }

    private static async Task UpsertPreviewTrackingAsync(
        AppDbContext db,
        ChapterBatchGenerationRequest request,
        ChapterDto chapter,
        ChapterBatchGenerationPreviewItemDto preview,
        IReadOnlyList<ChapterBatchGenerationScenePreviewDto> scenes,
        string? sourceBookId,
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
            var row = await db.Foreshadowings.FirstOrDefaultAsync(x =>
                x.ProjectId == request.ProjectId
                && x.SourceBookId == sourceBookId
                && x.Name == name, ct);
            if (row is null)
            {
                row = new Foreshadowing
                {
                    ProjectId = request.ProjectId,
                    SourceBookId = sourceBookId,
                    Name = name,
                    Tier = "Tier-2"
                };
                db.Foreshadowings.Add(row);
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

        var timeline = await db.ChapterTimelines.FirstOrDefaultAsync(x =>
            x.ProjectId == request.ProjectId
            && x.ChapterId == chapter.Id
            && x.SourceBookId == sourceBookId, ct);
        if (timeline is null)
        {
            db.ChapterTimelines.Add(new ChapterTimeline
            {
                ProjectId = request.ProjectId,
                ChapterId = chapter.Id,
                SourceBookId = sourceBookId,
                TimePeriod = FirstNonEmpty(timelineScene.TimeAnchor, $"第{chapter.ChapterNumber}章"),
                ElapsedTime = timelineScene.ElapsedFromPrevious,
                KeyTimeEvent = FirstNonEmpty(timelineScene.TimelineEffect, preview.Summary, chapter.Summary, chapter.Title),
                Importance = "normal"
            });
            return;
        }

        if (string.IsNullOrWhiteSpace(timeline.TimePeriod)) timeline.TimePeriod = timelineScene.TimeAnchor;
        if (string.IsNullOrWhiteSpace(timeline.ElapsedTime)) timeline.ElapsedTime = timelineScene.ElapsedFromPrevious;
        if (string.IsNullOrWhiteSpace(timeline.KeyTimeEvent)) timeline.KeyTimeEvent = FirstNonEmpty(timelineScene.TimelineEffect, preview.Summary, chapter.Summary, chapter.Title);
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

    private static string ResolveSceneEstimatedWordCount(ChapterBatchGenerationRequest request, int sceneCount)
    {
        var total = Math.Clamp(request.MaxTokens ?? 4096, 1500, 12000);
        return $"{Math.Max(800, total / Math.Max(1, sceneCount))}";
    }

    private static bool ShouldReplaceChapterTitle(string? currentTitle, string resolvedTitle, int chapterNumber)
    {
        if (string.IsNullOrWhiteSpace(resolvedTitle) || string.Equals(currentTitle?.Trim(), resolvedTitle, StringComparison.Ordinal))
        {
            return false;
        }

        var normalized = NormalizeTitle(currentTitle);
        var titleSuffix = NormalizeTitle(CleanChapterTitle(currentTitle, chapterNumber));
        return string.IsNullOrWhiteSpace(normalized)
               || normalized == chapterNumber.ToString()
               || normalized is "章节" or "未命名" or "待生成"
               || titleSuffix is "" or "章节" or "未命名" or "待生成" or "线索展开" or "阶段推进" or "情节推进";
    }

    private static string BuildRequiredHeading(ChapterDto chapter)
    {
        var title = CleanChapterTitle(chapter.Title, chapter.ChapterNumber);
        return string.IsNullOrWhiteSpace(title)
            ? BuildFallbackChapterTitle(chapter.ChapterNumber)
            : $"第{chapter.ChapterNumber}章 {title}";
    }

    private static string BuildFallbackChapterTitle(int chapterNumber)
    {
        var stages = new[]
        {
            "起势入局",
            "暗线浮出",
            "试探交锋",
            "压力逼近",
            "疑云转折",
            "破局行动",
            "追击升级",
            "关键抉择",
            "反转爆点",
            "余波钩子"
        };
        var arcs = new[]
        {
            "开端",
            "承压",
            "试探",
            "破局",
            "转折",
            "追索",
            "对抗",
            "抉择",
            "爆发",
            "收束",
            "伏线",
            "追光",
            "暗涌",
            "借势",
            "困局",
            "突围",
            "反攻",
            "揭幕",
            "沉淀",
            "启新"
        };
        var stage = stages[(chapterNumber - 1) % stages.Length];
        var arc = arcs[((chapterNumber - 1) / stages.Length) % arcs.Length];
        return $"第{chapterNumber}章 {arc}节点·{stage}";
    }

    private static string BuildFallbackChapterSummary(int chapterNumber, string title, string? note = null)
    {
        var cleanTitle = FirstNonEmpty(CleanChapterTitle(title, chapterNumber), title, $"第{chapterNumber}章");
        var focuses = new[]
        {
            "承接上一章余波，推动主角确认眼前目标，并让新的压力进入明面。",
            "围绕关键线索展开试探行动，制造信息差，让阻力从暗处逼近。",
            "把人物选择、外部威胁和阶段目标扣在一起，形成可落地的正文方向。",
            "安排局势变化与章末钩子，为下一章的追击、反转或回收留下入口。"
        };
        var focus = focuses[(chapterNumber - 1) % focuses.Length];
        var prefix = string.IsNullOrWhiteSpace(note) ? "临时规划" : note.Trim();
        return $"{prefix}：本章围绕《{cleanTitle}》推进，{focus}请确认标题、简介和场景后再启动正文生成。";
    }

    private static string CleanChapterTitle(string? title, int chapterNumber)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return string.Empty;
        }

        var trimmed = title.Trim();
        var compact = NormalizeTitle(trimmed);
        var prefixes = new[]
        {
            $"第{chapterNumber}章",
            $"第{chapterNumber}章节",
            $"{chapterNumber}章",
            $"章节{chapterNumber}"
        };

        foreach (var prefix in prefixes)
        {
            if (compact.StartsWith(prefix, StringComparison.Ordinal))
            {
                var prefixIndex = trimmed.IndexOf('章');
                if (prefixIndex >= 0)
                {
                    return prefixIndex + 1 < trimmed.Length
                        ? trimmed[(prefixIndex + 1)..].Trim(' ', '\t', '：', ':', '-', '－', '—', '_')
                        : string.Empty;
                }
            }
        }

        return trimmed;
    }

    private static string NormalizeTitle(string? title)
        => string.IsNullOrWhiteSpace(title)
            ? string.Empty
            : new string(title.Where(c => !char.IsWhiteSpace(c) && c is not ':' and not '：' and not '-' and not '－' and not '—' and not '_').ToArray());

    private static IQueryable<T> FilterBySourceBook<T>(IQueryable<T> query, string? sourceBookId)
        where T : TM.Web.Domain.Common.BusinessDataBase
        => string.IsNullOrWhiteSpace(sourceBookId)
            ? query
            : query.Where(x => x.SourceBookId == sourceBookId);

    private static string? GetChapterId(object? chapter)
        => chapter switch
        {
            ChapterDto dto => dto.Id,
            Chapter entity => entity.Id,
            _ => null
        };

    private static string GetChapterTitle(object? chapter)
        => chapter switch
        {
            ChapterDto dto => dto.Title,
            Chapter entity => entity.Title,
            _ => string.Empty
        };

    private static string GetChapterSummary(object? chapter)
        => chapter switch
        {
            ChapterDto dto => dto.Summary,
            Chapter entity => entity.Summary,
            _ => string.Empty
        };

    private static bool ChapterHasContent(object? chapter)
        => chapter switch
        {
            ChapterDto dto => !string.IsNullOrWhiteSpace(dto.Content) || dto.WordCount > 0,
            Chapter entity => !string.IsNullOrWhiteSpace(entity.ContentFilePath) && entity.WordCount > 0,
            _ => false
        };

    private static string FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim() ?? string.Empty;

    private static async Task PersistNotificationAsync(
        AppDbContext db,
        ChapterBatchGenerationJobStatusDto status,
        CancellationToken ct)
    {
        db.NotificationHistory.Add(new NotificationHistory
        {
            Id = $"notif_{Guid.NewGuid():N}"[..30],
            Type = status.Failed > 0 ? "warning" : status.Status == "cancelled" ? "info" : "success",
            Title = "后台章节生成已结束",
            Body = $"成功 {status.Completed} 章，跳过 {status.Skipped} 章，失败 {status.Failed} 章。",
            RouteLink = "/generate/chapters",
            IsRead = false
        });
        await db.SaveChangesAsync(ct);
    }

    private static string BuildFailureMessage(Exception ex)
    {
        var messages = new List<string>();
        var current = ex;
        while (current is not null && messages.Count < 3)
        {
            var message = current.Message?.Trim();
            if (!string.IsNullOrWhiteSpace(message) && !messages.Contains(message, StringComparer.Ordinal))
            {
                messages.Add(message);
            }

            current = current.InnerException;
        }

        var merged = messages.Count == 0 ? "生成失败，请查看后端日志。" : string.Join(" | ", messages);
        return merged.Length <= 240 ? merged : $"{merged[..237]}...";
    }
}
