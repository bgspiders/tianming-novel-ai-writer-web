using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Global;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Design;

public sealed class BookAnalysisBackgroundWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IBookAnalysisBackgroundJobQueue _queue;
    private readonly ILogger<BookAnalysisBackgroundWorker> _logger;

    public BookAnalysisBackgroundWorker(
        IServiceScopeFactory scopeFactory,
        IBookAnalysisBackgroundJobQueue queue,
        ILogger<BookAnalysisBackgroundWorker> logger)
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
                _logger.LogError(ex, "Background book analysis job failed. JobId={JobId} BookAnalysisId={BookAnalysisId}", job.JobId, job.BookAnalysisId);
                await PersistFailureAsync(job, BuildFailureMessage(ex), stoppingToken);
            }
        }
    }

    private async Task ProcessJobAsync(BookAnalysisBackgroundAnalyzeJob job, CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var crawler = scope.ServiceProvider.GetRequiredService<IBookAnalysisCrawlerService>();

        var entity = await db.BookAnalyses.FirstOrDefaultAsync(x => x.Id == job.BookAnalysisId, ct)
            ?? throw new InvalidOperationException($"Book analysis not found: {job.BookAnalysisId}");

        entity.BackgroundAiStatus = "running";
        entity.BackgroundAiJobId = job.JobId;
        entity.BackgroundAiMessage = "AI analysis is running in the background.";
        entity.BackgroundAiRequestedAt ??= job.QueuedAt;
        await db.SaveChangesAsync(ct);

        var preview = await BuildPreviewAsync(crawler, entity, ct);
        var analyzed = await crawler.AnalyzePreviewAsync(new BookAnalysisAiAnalyzeRequest(
            job.Request.ProviderId,
            job.Request.ApiKeyId,
            job.Request.Endpoint,
            job.Request.Model,
            preview,
            job.Request.MaxTokens), ct);

        ApplyAnalyzeResult(entity, analyzed, job);
        db.NotificationHistory.Add(new NotificationHistory
        {
            Id = $"notif_{Guid.NewGuid():N}"[..30],
            Type = "success",
            Title = "拆书 AI 分析已完成",
            Body = $"《{entity.Name}》的后台 AI 分析已经完成，结果已回填到拆书记录。",
            RouteLink = "/design/book_analyses",
            IsRead = false
        });
        await db.SaveChangesAsync(ct);
    }

    private async Task PersistFailureAsync(
        BookAnalysisBackgroundAnalyzeJob job,
        string message,
        CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var entity = await db.BookAnalyses.FirstOrDefaultAsync(x => x.Id == job.BookAnalysisId, ct);
        if (entity is null)
        {
            return;
        }

        entity.BackgroundAiStatus = "failed";
        entity.BackgroundAiJobId = job.JobId;
        entity.BackgroundAiFinishedAt = DateTime.UtcNow;
        entity.BackgroundAiMessage = message;

        db.NotificationHistory.Add(new NotificationHistory
        {
            Id = $"notif_{Guid.NewGuid():N}"[..30],
            Type = "error",
            Title = "拆书 AI 分析失败",
            Body = $"《{entity.Name}》的后台 AI 分析失败：{message}",
            RouteLink = "/design/book_analyses",
            IsRead = false
        });

        await db.SaveChangesAsync(ct);
    }

    private static async Task<BookAnalysisCrawlPreviewDto> BuildPreviewAsync(
        IBookAnalysisCrawlerService crawler,
        TM.Web.Domain.Entities.Design.BookAnalysis entity,
        CancellationToken ct)
    {
        if (Uri.TryCreate(entity.SourceUrl, UriKind.Absolute, out var sourceUri)
            && (sourceUri.Scheme == Uri.UriSchemeHttp || sourceUri.Scheme == Uri.UriSchemeHttps))
        {
            try
            {
                return await crawler.CrawlPreviewAsync(new BookAnalysisCrawlPreviewRequest(
                    entity.SourceUrl,
                    MaxChapters: 12,
                    IncludeContent: true), ct);
            }
            catch
            {
                // Fall back to persisted summary-based preview when source site is unavailable.
            }
        }

        return new BookAnalysisCrawlPreviewDto(
            SourceUrl: entity.SourceUrl,
            SourceSite: entity.SourceSite,
            SuggestedName: entity.Name,
            Title: entity.SourceBookTitle,
            Author: entity.SourceAuthor,
            Genre: entity.SourceGenre,
            Keywords: entity.SourceKeywords,
            ChapterCount: entity.ChapterCount,
            TotalWordCount: entity.TotalWordCount,
            CrawledAt: entity.CrawledAt ?? entity.UpdatedAt,
            Summary: BuildSummary(entity),
            WorldBuildingMethod: entity.WorldBuildingMethod,
            PowerSystemDesign: entity.PowerSystemDesign,
            EnvironmentDescription: entity.EnvironmentDescription,
            FactionDesign: entity.FactionDesign,
            WorldviewHighlights: entity.WorldviewHighlights,
            ProtagonistDesign: entity.ProtagonistDesign,
            SupportingRoles: entity.SupportingRoles,
            CharacterRelations: entity.CharacterRelations,
            GoldenFingerDesign: entity.GoldenFingerDesign,
            CharacterHighlights: entity.CharacterHighlights,
            PlotStructure: entity.PlotStructure,
            ConflictDesign: entity.ConflictDesign,
            ClimaxArrangement: entity.ClimaxArrangement,
            ForeshadowingTechnique: entity.ForeshadowingTechnique,
            PlotHighlights: entity.PlotHighlights,
            Chapters: Array.Empty<BookAnalysisCrawlChapterDto>());
    }

    private static string BuildSummary(TM.Web.Domain.Entities.Design.BookAnalysis entity)
    {
        var parts = new[]
        {
            entity.WorldBuildingMethod,
            entity.ProtagonistDesign,
            entity.PlotStructure,
            entity.PlotHighlights
        }.Where(static x => !string.IsNullOrWhiteSpace(x));

        return string.Join("\n\n", parts).Trim();
    }

    private static void ApplyAnalyzeResult(
        TM.Web.Domain.Entities.Design.BookAnalysis entity,
        BookAnalysisCrawlPreviewDto analyzed,
        BookAnalysisBackgroundAnalyzeJob job)
    {
        entity.WorldBuildingMethod = analyzed.WorldBuildingMethod;
        entity.PowerSystemDesign = analyzed.PowerSystemDesign;
        entity.EnvironmentDescription = analyzed.EnvironmentDescription;
        entity.FactionDesign = analyzed.FactionDesign;
        entity.WorldviewHighlights = analyzed.WorldviewHighlights;
        entity.ProtagonistDesign = analyzed.ProtagonistDesign;
        entity.SupportingRoles = analyzed.SupportingRoles;
        entity.CharacterRelations = analyzed.CharacterRelations;
        entity.GoldenFingerDesign = analyzed.GoldenFingerDesign;
        entity.CharacterHighlights = analyzed.CharacterHighlights;
        entity.PlotStructure = analyzed.PlotStructure;
        entity.ConflictDesign = analyzed.ConflictDesign;
        entity.ClimaxArrangement = analyzed.ClimaxArrangement;
        entity.ForeshadowingTechnique = analyzed.ForeshadowingTechnique;
        entity.PlotHighlights = analyzed.PlotHighlights;
        entity.BackgroundAiStatus = "completed";
        entity.BackgroundAiJobId = job.JobId;
        entity.BackgroundAiRequestedAt ??= job.QueuedAt;
        entity.BackgroundAiFinishedAt = DateTime.UtcNow;
        entity.BackgroundAiMessage = "AI analysis completed.";
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

            current = current.InnerException!;
        }

        if (messages.Count == 0)
        {
            return "AI 分析失败，请查看后端日志。";
        }

        var merged = string.Join(" | ", messages);
        merged = merged
            .Replace("ProviderId", "Provider", StringComparison.OrdinalIgnoreCase)
            .Replace("ApiKeyId", "Key", StringComparison.OrdinalIgnoreCase)
            .Replace("Endpoint", "Endpoint", StringComparison.OrdinalIgnoreCase)
            .Replace("Model", "模型", StringComparison.OrdinalIgnoreCase);

        if (merged.Length <= 240)
        {
            return merged;
        }

        return $"{merged[..237]}...";
    }
}
