using TM.Web.Application.Dtos.Design;

namespace TM.Web.Application.Services;

public interface IBookAnalysisCrawlerService
{
    Task<BookAnalysisCrawlPreviewDto> CrawlPreviewAsync(BookAnalysisCrawlPreviewRequest request, CancellationToken ct = default);
}
