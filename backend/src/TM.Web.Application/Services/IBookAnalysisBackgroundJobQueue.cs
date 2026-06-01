using TM.Web.Application.Dtos.Design;

namespace TM.Web.Application.Services;

public interface IBookAnalysisBackgroundJobQueue
{
    ValueTask EnqueueAsync(BookAnalysisBackgroundAnalyzeJob job, CancellationToken ct = default);

    ValueTask<BookAnalysisBackgroundAnalyzeJob> DequeueAsync(CancellationToken ct);
}

public sealed record BookAnalysisBackgroundAnalyzeJob(
    string JobId,
    string BookAnalysisId,
    BookAnalysisBackgroundAnalyzeRequest Request,
    DateTime QueuedAt);
