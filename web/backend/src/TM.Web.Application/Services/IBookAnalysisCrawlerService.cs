using TM.Web.Application.Dtos.Design;

namespace TM.Web.Application.Services;

public interface IBookAnalysisCrawlerService
{
    Task<BookAnalysisCrawlPreviewDto> CrawlPreviewAsync(BookAnalysisCrawlPreviewRequest request, CancellationToken ct = default);

    Task<BookAnalysisCrawlPreviewDto> AnalyzePreviewAsync(BookAnalysisAiAnalyzeRequest request, CancellationToken ct = default);

    Task<BookAnalysisBackgroundAnalyzeAcceptedDto> QueueBackgroundAnalyzeAsync(
        string bookAnalysisId,
        BookAnalysisBackgroundAnalyzeRequest request,
        CancellationToken ct = default);
}
