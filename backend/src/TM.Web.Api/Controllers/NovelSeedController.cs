using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/novel-seed")]
public sealed class NovelSeedController : ControllerBase
{
    private readonly INovelSeedService _novelSeed;

    public NovelSeedController(INovelSeedService novelSeed)
    {
        _novelSeed = novelSeed;
    }

    [HttpGet("plans")]
    public Task<IReadOnlyList<NovelSeedPlanSummaryDto>> ListPlans(CancellationToken ct)
        => _novelSeed.ListPlansAsync(ct);

    [HttpPost("plans/{projectId}/conversation")]
    public Task<NovelSeedConversationDto> GetOrCreateConversation(
        string projectId,
        [FromQuery] string? providerId,
        [FromQuery] string? modelCode,
        CancellationToken ct)
        => _novelSeed.GetOrCreateConversationAsync(projectId, providerId, modelCode, ct);

    [HttpPost]
    public Task<NovelSeedResult> Generate([FromBody] NovelSeedRequest request, CancellationToken ct)
        => _novelSeed.GenerateAsync(request, ct);
}
