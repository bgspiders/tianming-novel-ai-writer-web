using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Global;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Generation;

public sealed class ChapterBatchGenerationWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IChapterBatchGenerationJobQueue _queue;
    private readonly IChapterBatchGenerationService _jobs;
    private readonly ILogger<ChapterBatchGenerationWorker> _logger;

    public ChapterBatchGenerationWorker(
        IServiceScopeFactory scopeFactory,
        IChapterBatchGenerationJobQueue queue,
        IChapterBatchGenerationService jobs,
        ILogger<ChapterBatchGenerationWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _queue = queue;
        _jobs = jobs;
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
                if (_jobs is ChapterBatchGenerationService service && service.TryGetState(job.JobId) is { } state)
                {
                    state.AddFailed(0, "后台任务", BuildFailureMessage(ex));
                    state.MarkCompleted();
                }
            }
        }
    }

    private async Task ProcessJobAsync(ChapterBatchGenerationJob job, CancellationToken ct)
    {
        if (_jobs is not ChapterBatchGenerationService service || service.TryGetState(job.JobId) is not { } state)
        {
            return;
        }

        state.MarkRunning();

        await using var scope = _scopeFactory.CreateAsyncScope();
        var chapters = scope.ServiceProvider.GetRequiredService<IChapterService>();
        var drafts = scope.ServiceProvider.GetRequiredService<IChapterDraftService>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        for (var offset = 0; offset < job.Request.Count; offset++)
        {
            if (state.CancelRequested)
            {
                break;
            }

            var chapterNumber = job.Request.StartChapterNumber + offset;
            try
            {
                var chapter = await EnsureChapterAsync(chapters, job.Request, chapterNumber, state, ct);
                var detail = await chapters.GetAsync(chapter.Id, ct)
                             ?? throw new InvalidOperationException($"章节不存在：{chapter.Id}");

                state.SetCurrent(detail.ChapterNumber, detail.Title);

                if (!job.Request.OverwriteExisting && !string.IsNullOrWhiteSpace(detail.Content))
                {
                    state.AddSkipped(detail.ChapterNumber, detail.Title);
                    continue;
                }

                await drafts.GenerateDraftAsync(BuildDraftRequest(job, detail), ct);
                state.AddCompleted(detail.ChapterNumber, detail.Title);
            }
            catch (Exception ex)
            {
                var title = await FindChapterTitleAsync(db, job.Request.VolumeId, chapterNumber, ct);
                state.AddFailed(chapterNumber, title, BuildFailureMessage(ex));
                if (job.Request.StopOnFailure)
                {
                    break;
                }
            }
        }

        state.MarkCompleted();
        await PersistNotificationAsync(db, state.ToDto(), ct);
    }

    private static async Task<ChapterDto> EnsureChapterAsync(
        IChapterService chapters,
        ChapterBatchGenerationRequest request,
        int chapterNumber,
        ChapterBatchGenerationJobState state,
        CancellationToken ct)
    {
        var existing = (await chapters.ListAsync(request.ProjectId, request.VolumeId, ct))
            .FirstOrDefault(x => x.ChapterNumber == chapterNumber);
        if (existing is not null)
        {
            return existing;
        }

        if (!request.CreateMissing)
        {
            throw new InvalidOperationException($"第 {chapterNumber} 章不存在，且未启用自动创建。");
        }

        var created = await chapters.CreateAsync(new ChapterUpsertDto(
            request.ProjectId,
            request.VolumeId,
            chapterNumber,
            $"第 {chapterNumber} 章",
            string.Empty,
            string.Empty,
            "planned"), ct);
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

    private static string BuildPrompt(ChapterBatchGenerationRequest request, ChapterDto chapter)
        => string.Join('\n', new[]
        {
            $"项目：{request.ProjectId}",
            $"卷：{request.VolumeId}",
            $"章节：{chapter.ChapterNumber} / {chapter.Title}",
            string.IsNullOrWhiteSpace(chapter.Summary) ? string.Empty : $"摘要：{chapter.Summary}",
            string.Empty,
            "请直接输出章节草稿，保持叙事连贯清晰。"
        }.Where(x => x.Length > 0));

    private static async Task<string> FindChapterTitleAsync(AppDbContext db, string volumeId, int chapterNumber, CancellationToken ct)
        => await db.Chapters.AsNoTracking()
               .Where(x => x.VolumeId == volumeId && x.ChapterNumber == chapterNumber)
               .Select(x => x.Title)
               .FirstOrDefaultAsync(ct)
           ?? $"第 {chapterNumber} 章";

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
