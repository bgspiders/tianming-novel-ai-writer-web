using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers.Design;

[ApiController]
[Route("api/design/book-analyses")]
public sealed class BookAnalysisCrawlerController : ControllerBase
{
    private readonly IBookAnalysisCrawlerService _crawler;

    public BookAnalysisCrawlerController(IBookAnalysisCrawlerService crawler)
    {
        _crawler = crawler;
    }

    [HttpPost("crawl-preview")]
    public Task<BookAnalysisCrawlPreviewDto> CrawlPreview([FromBody] BookAnalysisCrawlPreviewRequest request, CancellationToken ct)
    {
        return _crawler.CrawlPreviewAsync(request, ct);
    }
}
