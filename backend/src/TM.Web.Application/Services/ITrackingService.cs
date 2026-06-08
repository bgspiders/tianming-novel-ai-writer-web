using TM.Web.Application.Dtos.Tracking;

namespace TM.Web.Application.Services;

public interface INarrativeTrackingService
{
    Task<IReadOnlyList<ForeshadowingDto>> ListForeshadowingsAsync(TrackingListQuery query, CancellationToken ct = default);
    Task<ForeshadowingDto> CreateForeshadowingAsync(ForeshadowingUpsertDto input, CancellationToken ct = default);
    Task<ForeshadowingDto> UpdateForeshadowingAsync(string id, ForeshadowingUpsertDto input, CancellationToken ct = default);
    Task DeleteForeshadowingAsync(string id, CancellationToken ct = default);

    Task<IReadOnlyList<TimelineDto>> ListTimelinesAsync(TrackingListQuery query, CancellationToken ct = default);
    Task<TimelineDto> CreateTimelineAsync(TimelineUpsertDto input, CancellationToken ct = default);
    Task<TimelineDto> UpdateTimelineAsync(string id, TimelineUpsertDto input, CancellationToken ct = default);
    Task DeleteTimelineAsync(string id, CancellationToken ct = default);

    Task<LongNovelCompletenessDto> GetCompletenessAsync(string projectId, string? sourceBookId = null, CancellationToken ct = default);
    Task<TrackingRebuildResultDto> RebuildTrackingAsync(TrackingRebuildRequest request, CancellationToken ct = default);
}
