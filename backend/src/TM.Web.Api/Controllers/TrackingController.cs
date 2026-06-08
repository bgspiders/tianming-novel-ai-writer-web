using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Tracking;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/tracking")]
public class TrackingController : ControllerBase
{
    private readonly INarrativeTrackingService _tracking;

    public TrackingController(INarrativeTrackingService tracking)
    {
        _tracking = tracking;
    }

    [HttpGet("foreshadowings")]
    public Task<IReadOnlyList<ForeshadowingDto>> ListForeshadowings([FromQuery] TrackingListQuery query, CancellationToken ct)
        => _tracking.ListForeshadowingsAsync(query, ct);

    [HttpPost("foreshadowings")]
    public Task<ForeshadowingDto> CreateForeshadowing([FromBody] ForeshadowingUpsertDto input, CancellationToken ct)
        => _tracking.CreateForeshadowingAsync(input, ct);

    [HttpPut("foreshadowings/{id}")]
    public Task<ForeshadowingDto> UpdateForeshadowing(string id, [FromBody] ForeshadowingUpsertDto input, CancellationToken ct)
        => _tracking.UpdateForeshadowingAsync(id, input, ct);

    [HttpDelete("foreshadowings/{id}")]
    public async Task<IActionResult> DeleteForeshadowing(string id, CancellationToken ct)
    {
        await _tracking.DeleteForeshadowingAsync(id, ct);
        return NoContent();
    }

    [HttpGet("timelines")]
    public Task<IReadOnlyList<TimelineDto>> ListTimelines([FromQuery] TrackingListQuery query, CancellationToken ct)
        => _tracking.ListTimelinesAsync(query, ct);

    [HttpPost("timelines")]
    public Task<TimelineDto> CreateTimeline([FromBody] TimelineUpsertDto input, CancellationToken ct)
        => _tracking.CreateTimelineAsync(input, ct);

    [HttpPut("timelines/{id}")]
    public Task<TimelineDto> UpdateTimeline(string id, [FromBody] TimelineUpsertDto input, CancellationToken ct)
        => _tracking.UpdateTimelineAsync(id, input, ct);

    [HttpDelete("timelines/{id}")]
    public async Task<IActionResult> DeleteTimeline(string id, CancellationToken ct)
    {
        await _tracking.DeleteTimelineAsync(id, ct);
        return NoContent();
    }

    [HttpGet("completeness")]
    public Task<LongNovelCompletenessDto> GetCompleteness([FromQuery] string projectId, [FromQuery] string? sourceBookId, CancellationToken ct)
        => _tracking.GetCompletenessAsync(projectId, sourceBookId, ct);

    [HttpPost("rebuild")]
    public Task<TrackingRebuildResultDto> RebuildTracking([FromBody] TrackingRebuildRequest input, CancellationToken ct)
        => _tracking.RebuildTrackingAsync(input, ct);
}
