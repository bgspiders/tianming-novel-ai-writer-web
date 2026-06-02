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
    private readonly AppDbContext _db;

    public GenerationController(
        IChapterDraftService drafts,
        IChapterBatchGenerationService chapterBatchJobs,
        IContextPackagingService packaging,
        AppDbContext db)
    {
        _drafts = drafts;
        _chapterBatchJobs = chapterBatchJobs;
        _packaging = packaging;
        _db = db;
    }

    [HttpPost("package-context")]
    public Task<PackageContextResult> PackageContext([FromBody] PackageContextRequest request, CancellationToken ct)
        => _packaging.PackageAsync(request, ct);

    [HttpPost("chapter-draft")]
    public Task<ChapterDraftResult> GenerateChapterDraft([FromBody] ChapterDraftRequest request, CancellationToken ct)
        => _drafts.GenerateDraftAsync(request, ct);

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
}
