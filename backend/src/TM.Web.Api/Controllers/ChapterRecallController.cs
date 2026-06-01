using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Recall;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/chapters")]
public class ChapterRecallController : ControllerBase
{
    private readonly IChapterRecallService _recallService;

    public ChapterRecallController(IChapterRecallService recallService)
    {
        _recallService = recallService;
    }

    [HttpGet("{id}/recall")]
    public async Task<ActionResult<ChapterRecallResponseDto>> Recall(
        string id,
        [FromQuery] string? query,
        [FromQuery] int topK = 5,
        CancellationToken ct = default)
    {
        var result = await _recallService.RecallAsync(id, query, topK, ct);
        return result == null ? NotFound() : Ok(result);
    }
}
