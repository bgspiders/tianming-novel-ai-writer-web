using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Runtime;
using TM.Web.Infrastructure.Persistence;
using TM.Web.Infrastructure.Services.Generation;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/generation")]
public class GenerationController : ControllerBase
{
    private readonly IChapterDraftService _drafts;
    private readonly IChapterBatchGenerationService _chapterBatchJobs;
    private readonly IContextPackagingService _packaging;
    private readonly IGenerationPreflightService _preflight;
    private readonly ISceneGenerationService _scenes;
    private readonly IChapterAnalysisService _analysis;
    private readonly AppDbContext _db;

    public GenerationController(
        IChapterDraftService drafts,
        IChapterBatchGenerationService chapterBatchJobs,
        IContextPackagingService packaging,
        IGenerationPreflightService preflight,
        ISceneGenerationService scenes,
        IChapterAnalysisService analysis,
        AppDbContext db)
    {
        _drafts = drafts;
        _chapterBatchJobs = chapterBatchJobs;
        _packaging = packaging;
        _preflight = preflight;
        _scenes = scenes;
        _analysis = analysis;
        _db = db;
    }

    [HttpPost("package-context")]
    public Task<PackageContextResult> PackageContext([FromBody] PackageContextRequest request, CancellationToken ct)
        => _packaging.PackageAsync(request, ct);

    [HttpGet("flow-status")]
    public async Task<ActionResult<GenerationFlowStatusDto>> GetFlowStatus([FromQuery] string projectId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(projectId)) return BadRequest("项目 ID 不能为空。");
        var project = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == projectId, ct);
        if (project == null) return NotFound();
        var sourceBookId = project.CurrentSourceBookId;

        async Task<int> countDesignAsync<T>(IQueryable<T> query) where T : class
            => string.IsNullOrWhiteSpace(sourceBookId)
                ? await query.CountAsync(ct)
                : await query.Where(x => EF.Property<string?>(x, "SourceBookId") == sourceBookId).CountAsync(ct);

        async Task<DateTime?> maxDesignUpdatedAsync<T>(IQueryable<T> query) where T : class
        {
            var scoped = string.IsNullOrWhiteSpace(sourceBookId)
                ? query
                : query.Where(x => EF.Property<string?>(x, "SourceBookId") == sourceBookId);
            return await scoped.AnyAsync(ct)
                ? await scoped.Select(x => (DateTime?)EF.Property<DateTime>(x, "UpdatedAt")).MaxAsync(ct)
                : null;
        }

        async Task<DateTime?> maxUpdatedAsync<T>(IQueryable<T> query) where T : class
            => await query.AnyAsync(ct)
                ? await query.Select(x => (DateTime?)EF.Property<DateTime>(x, "UpdatedAt")).MaxAsync(ct)
                : null;

        var worldRules = await countDesignAsync(_db.WorldRules.AsNoTracking());
        var characterRules = await countDesignAsync(_db.CharacterRules.AsNoTracking());
        var creativeMaterials = await countDesignAsync(_db.CreativeMaterials.AsNoTracking());
        var outlines = await countDesignAsync(_db.Outlines.AsNoTracking());
        var volumeDesigns = await countDesignAsync(_db.VolumeDesigns.AsNoTracking());
        var chapterPlans = await countDesignAsync(_db.ChapterPlans.AsNoTracking());
        var blueprints = await countDesignAsync(_db.ChapterBlueprints.AsNoTracking());
        var foreshadowings = string.IsNullOrWhiteSpace(sourceBookId)
            ? await _db.Foreshadowings.AsNoTracking().CountAsync(x => x.ProjectId == projectId, ct)
            : await _db.Foreshadowings.AsNoTracking().CountAsync(x => x.ProjectId == projectId && x.SourceBookId == sourceBookId, ct);
        var timelines = string.IsNullOrWhiteSpace(sourceBookId)
            ? await _db.ChapterTimelines.AsNoTracking().CountAsync(x => x.ProjectId == projectId, ct)
            : await _db.ChapterTimelines.AsNoTracking().CountAsync(x => x.ProjectId == projectId && x.SourceBookId == sourceBookId, ct);
        var chapters = await _db.Chapters.AsNoTracking().CountAsync(x => x.ProjectId == projectId, ct);
        var drafted = await _db.Chapters.AsNoTracking().CountAsync(x => x.ProjectId == projectId && x.WordCount > 0, ct);
        var validations = await _db.ValidationSummaries.AsNoTracking().CountAsync(x => x.ProjectId == projectId, ct);
        var manifests = await _db.Manifests.AsNoTracking().CountAsync(x => x.ProjectId == projectId, ct);
        var recentError = await _db.ChapterBatchGenerationJobRecords.AsNoTracking()
            .Where(x => x.ProjectId == projectId && (x.Status == "failed" || x.Failed > 0))
            .OrderByDescending(x => x.UpdatedAt)
            .Select(x => x.Message)
            .FirstOrDefaultAsync(ct);

        var steps = new List<GenerationFlowStepStatusDto>
        {
            FlowStep("novel_seed", "AI 开书", string.IsNullOrWhiteSpace(sourceBookId) ? 0 : 1, "/generate/novel-seed", "生成或选择一个开书项目。", project.UpdatedAt),
            FlowStep("knowledge_base", "五件套绑定", worldRules + characterRules + creativeMaterials, "/generate/tianming-protocol", "绑定世界基石、角色档案和文风样本。", await maxDesignUpdatedAsync(_db.WorldRules.AsNoTracking())),
            FlowStep("outline", "大纲/规划", outlines + volumeDesigns, "/generate/outlines", "维护大纲和分卷规划。", await maxDesignUpdatedAsync(_db.Outlines.AsNoTracking())),
            FlowStep("chapter_plans", "章节计划", chapterPlans, "/generate/chapter_plans", "生成或修正章节计划。", await maxDesignUpdatedAsync(_db.ChapterPlans.AsNoTracking())),
            FlowStep("chapter_blueprints", "章节蓝图", blueprints, "/generate/chapter_blueprints", "拆分场景蓝图。", await maxDesignUpdatedAsync(_db.ChapterBlueprints.AsNoTracking())),
            FlowStep("tracking", "叙事追踪", foreshadowings + timelines, "/generate/tracking", $"伏笔 {foreshadowings} 条，时间线 {timelines} 条。", await maxUpdatedAsync(_db.ChapterTimelines.AsNoTracking().Where(x => x.ProjectId == projectId))),
            FlowStep("preflight", "生成预检", chapterPlans > 0 && blueprints > 0 ? 1 : 0, "/generate/chapters", "在章节生成页运行预检。", null),
            FlowStep("draft", "场景/正文", drafted, "/generate/chapters", chapters == 0 ? "先创建章节条目。" : $"已完成正文 {drafted}/{chapters} 章。", await maxUpdatedAsync(_db.Chapters.AsNoTracking().Where(x => x.ProjectId == projectId))),
            FlowStep("validation", "体检", validations, "/validate", string.IsNullOrWhiteSpace(recentError) ? "运行体检并处理失败项。" : recentError, await maxUpdatedAsync(_db.ValidationSummaries.AsNoTracking().Where(x => x.ProjectId == projectId))),
            FlowStep("archive", "存档/打包", manifests, "/generate", "打包上下文快照，保留生成依据。", await maxUpdatedAsync(_db.Manifests.AsNoTracking().Where(x => x.ProjectId == projectId)))
        };

        return Ok(new GenerationFlowStatusDto
        {
            ProjectId = projectId,
            SourceBookId = sourceBookId,
            Steps = steps,
            NextSuggestion = steps.FirstOrDefault(x => x.Status != "ready")?.Message ?? "当前流程基础项已齐备，可以继续批量生成或导出。"
        });
    }

    [HttpPost("chapter-draft")]
    public Task<ChapterDraftResult> GenerateChapterDraft([FromBody] ChapterDraftRequest request, CancellationToken ct)
        => _drafts.GenerateDraftAsync(request, ct);

    [HttpPost("preflight")]
    public Task<GenerationPreflightResult> RunPreflight([FromBody] GenerationPreflightRequest request, CancellationToken ct)
        => _preflight.CheckAsync(request, ct);

    [HttpPost("chapters/{chapterId}/scene-blueprints/ensure")]
    public Task<EnsureSceneBlueprintsResult> EnsureSceneBlueprints(
        string chapterId,
        [FromBody] EnsureSceneBlueprintsRequest request,
        CancellationToken ct)
    {
        request.ChapterId = chapterId;
        return _preflight.EnsureSceneBlueprintsAsync(request, ct);
    }

    [HttpPost("chapters/{chapterId}/preview/confirm")]
    public Task<ConfirmChapterGenerationPreviewResult> ConfirmChapterPreview(
        string chapterId,
        [FromBody] ConfirmChapterGenerationPreviewRequest request,
        CancellationToken ct)
    {
        request.ChapterId = chapterId;
        return _preflight.ConfirmPreviewAsync(request, ct);
    }

    [HttpPost("chapters/{chapterId}/scene-draft")]
    public Task<SceneDraftResult> GenerateSceneDraft(
        string chapterId,
        [FromBody] SceneDraftRequest request,
        CancellationToken ct)
    {
        request.ChapterId = chapterId;
        return _scenes.GenerateSceneDraftAsync(request, ct);
    }

    [HttpPost("chapters/{chapterId}/scene-compose")]
    public Task<SceneComposeResult> ComposeSceneDrafts(
        string chapterId,
        [FromBody] SceneComposeRequest request,
        CancellationToken ct)
    {
        request.ChapterId = chapterId;
        return _scenes.ComposeChapterAsync(request, ct);
    }

    [HttpPost("chapters/{chapterId}/analysis")]
    public Task<ChapterAnalysisResult> AnalyzeChapter(
        string chapterId,
        [FromBody] ChapterAnalysisRequest request,
        CancellationToken ct)
    {
        request.ChapterId = chapterId;
        return _analysis.AnalyzeAsync(request, ct);
    }

    [HttpPost("chapter-batch-jobs")]
    public Task<ChapterBatchGenerationAcceptedDto> QueueChapterBatchGeneration(
        [FromBody] ChapterBatchGenerationRequest request,
        CancellationToken ct)
        => _chapterBatchJobs.QueueAsync(request, ct);

    [HttpPost("chapter-batch-preview")]
    public Task<IReadOnlyList<ChapterBatchGenerationPreviewItemDto>> PreviewChapterBatchGeneration(
        [FromBody] ChapterBatchGenerationPreviewRequest request,
        CancellationToken ct)
        => ChapterBatchGenerationWorker.BuildPreviewAsync(_db, request, ct);

    [HttpGet("chapter-batch-jobs")]
    public IReadOnlyList<ChapterBatchGenerationJobStatusDto> ListChapterBatchGenerationJobs(
        [FromQuery] string? projectId,
        [FromQuery] int take = 20)
        => _chapterBatchJobs.ListRecent(projectId, take);

    [HttpGet("chapter-batch-jobs/{jobId}")]
    public ActionResult<ChapterBatchGenerationJobStatusDto> GetChapterBatchGenerationJob(string jobId)
    {
        var status = _chapterBatchJobs.GetStatus(jobId);
        return status == null ? NotFound() : Ok(status);
    }

    [HttpPost("chapter-batch-jobs/{jobId}/cancel")]
    public IActionResult CancelChapterBatchGenerationJob(string jobId)
        => _chapterBatchJobs.RequestCancel(jobId) ? NoContent() : NotFound();

    [HttpGet("records")]
    public async Task<IReadOnlyList<GenerationRecordDto>> ListRecords(
        [FromQuery] string projectId,
        [FromQuery] string? chapterId,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(projectId)) return Array.Empty<GenerationRecordDto>();
        take = Math.Clamp(take, 1, 200);

        var q = _db.GenerationRecords.AsNoTracking().Where(r => r.ProjectId == projectId);
        if (!string.IsNullOrWhiteSpace(chapterId)) q = q.Where(r => r.ChapterId == chapterId);

        var rows = await q.OrderByDescending(r => r.StartedAt).Take(take).ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    [HttpGet("prompt-snapshots")]
    public async Task<IReadOnlyList<PromptRunSnapshotDto>> ListPromptSnapshots(
        [FromQuery] string? projectId,
        [FromQuery] string? chapterId,
        [FromQuery] string? workflowId,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 200);
        var q = _db.PromptRunSnapshots.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(projectId)) q = q.Where(x => x.ProjectId == projectId);
        if (!string.IsNullOrWhiteSpace(chapterId)) q = q.Where(x => x.ChapterId == chapterId);
        if (!string.IsNullOrWhiteSpace(workflowId)) q = q.Where(x => x.WorkflowId == workflowId);
        var rows = await q.OrderByDescending(x => x.CreatedAt).Take(take).ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    [HttpGet("prompt-snapshots/{id}")]
    public async Task<ActionResult<PromptRunSnapshotDto>> GetPromptSnapshot(string id, CancellationToken ct)
    {
        var row = await _db.PromptRunSnapshots.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return row == null ? NotFound() : Ok(ToDto(row));
    }

    [HttpGet("statistics")]
    public async Task<ActionResult<GenerationStatisticsDto>> GetStatistics([FromQuery] string projectId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(projectId)) return BadRequest("项目 ID 不能为空。");
        var stats = await _db.GenerationStatistics.AsNoTracking().FirstOrDefaultAsync(s => s.ProjectId == projectId, ct);
        return Ok(stats == null
            ? new GenerationStatisticsDto(string.Empty, projectId, 0, 0, 0, 0, 0, 0, 0, DateTime.UtcNow)
            : ToDto(stats));
    }

    private static GenerationRecordDto ToDto(GenerationRecord r)
        => new(
            r.Id,
            r.ProjectId,
            r.ChapterId,
            r.Success,
            r.TotalAttempts,
            r.RewriteCount,
            r.FailureStages,
            r.Attempts,
            r.StartedAt,
            r.FinishedAt,
            r.CreatedAt,
            r.UpdatedAt);

    private static GenerationStatisticsDto ToDto(GenerationStatistics s)
        => new(
            s.Id,
            s.ProjectId,
            s.TotalGenerations,
            s.FirstPassCount,
            s.RewriteCount,
            s.FailureCount,
            s.TotalInputTokens,
            s.TotalOutputTokens,
            s.TotalCostMicros,
            s.LastUpdatedAt);

    private static PromptRunSnapshotDto ToDto(PromptRunSnapshot s)
        => new()
        {
            Id = s.Id,
            RunId = s.RunId,
            ProjectId = s.ProjectId,
            ChapterId = s.ChapterId,
            WorkflowId = s.WorkflowId,
            StepKey = s.StepKey,
            Source = s.Source,
            Model = s.Model,
            Temperature = s.Temperature,
            MaxTokens = s.MaxTokens,
            ContextHash = s.ContextHash,
            ContextSummary = s.ContextSummary,
            PromptSummary = s.PromptSummary,
            OutputSummary = s.OutputSummary,
            Success = s.Success,
            Error = s.Error,
            ElapsedMs = s.ElapsedMs,
            CreatedAt = s.CreatedAt
        };

    private static GenerationFlowStepStatusDto FlowStep(string key, string title, int count, string path, string message, DateTime? updatedAt)
        => new()
        {
            Key = key,
            Title = title,
            Count = count,
            Path = path,
            Message = count > 0 ? message : $"待完成：{message}",
            LastUpdatedAt = updatedAt,
            Status = count > 0 ? "ready" : "pending"
        };
}
