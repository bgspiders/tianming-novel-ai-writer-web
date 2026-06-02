using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Core;
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
                var chapter = await EnsureChapterAsync(chapters, db, job.Request, chapterNumber, state, ct);
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
                var title = await FindChapterTitleAsync(db, job.Request, chapterNumber, ct);
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
                state.AddLog($"已校正第 {updated.ChapterNumber} 章标题/简介：{updated.Title}");
                return updated;
            }

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
    {
        var heading = BuildRequiredHeading(chapter);
        return string.Join('\n', new[]
        {
            $"项目：{request.ProjectId}",
            $"卷：{request.VolumeId}",
            $"章节：{chapter.ChapterNumber} / {chapter.Title}",
            $"本章正文标题硬约束：{heading}",
            string.IsNullOrWhiteSpace(chapter.Summary) ? string.Empty : $"摘要：{chapter.Summary}",
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
                items.Add(new ChapterBatchGenerationPreviewItemDto
                {
                    ChapterNumber = chapterNumber,
                    Title = BuildFallbackChapterTitle(chapterNumber),
                    Summary = "章节不存在，且未启用自动创建。",
                    Exists = false,
                    HasContent = false,
                    Source = "missing"
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
                Source = "confirmed"
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
                Source = "chapter_plan"
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
                    Source = "chapter_blueprint"
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
                Source = "chapter"
            };
        }

        return new ChapterBatchGenerationPreviewItemDto
        {
            ChapterNumber = chapterNumber,
            Title = BuildFallbackChapterTitle(chapterNumber),
            Summary = "按当前章节号生成的临时简介，请确认后再启动正文生成。",
            Exists = chapterId is not null,
            HasContent = ChapterHasContent(chapter),
            Source = "fallback"
        };
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
        var suffix = stages[(chapterNumber - 1) % stages.Length];
        return $"第{chapterNumber}章 {suffix}";
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
