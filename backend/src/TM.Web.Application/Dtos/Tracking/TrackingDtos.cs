namespace TM.Web.Application.Dtos.Tracking;

public sealed class TrackingListQuery
{
    public string ProjectId { get; set; } = string.Empty;
    public string? SourceBookId { get; set; }
    public string? Keyword { get; set; }
    public int? StartChapterNumber { get; set; }
    public int? EndChapterNumber { get; set; }
}

public sealed class ForeshadowingDto
{
    public string Id { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public string? SourceBookId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Tier { get; set; } = "Tier-3";
    public bool IsSetup { get; set; }
    public bool IsResolved { get; set; }
    public bool IsOverdue { get; set; }
    public string ExpectedSetupChapter { get; set; } = string.Empty;
    public string ExpectedPayoffChapter { get; set; } = string.Empty;
    public string ActualSetupChapter { get; set; } = string.Empty;
    public string ActualPayoffChapter { get; set; } = string.Empty;
    public string OverdueSuggestion { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class ForeshadowingUpsertDto
{
    public string ProjectId { get; set; } = string.Empty;
    public string? SourceBookId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Tier { get; set; } = "Tier-3";
    public bool IsSetup { get; set; }
    public bool IsResolved { get; set; }
    public bool IsOverdue { get; set; }
    public string ExpectedSetupChapter { get; set; } = string.Empty;
    public string ExpectedPayoffChapter { get; set; } = string.Empty;
    public string ActualSetupChapter { get; set; } = string.Empty;
    public string ActualPayoffChapter { get; set; } = string.Empty;
    public string OverdueSuggestion { get; set; } = string.Empty;
}

public sealed class TimelineDto
{
    public string Id { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public string ChapterId { get; set; } = string.Empty;
    public string? SourceBookId { get; set; }
    public int ChapterNumber { get; set; }
    public string ChapterTitle { get; set; } = string.Empty;
    public string TimePeriod { get; set; } = string.Empty;
    public string ElapsedTime { get; set; } = string.Empty;
    public string KeyTimeEvent { get; set; } = string.Empty;
    public string Importance { get; set; } = "normal";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class TimelineUpsertDto
{
    public string ProjectId { get; set; } = string.Empty;
    public string ChapterId { get; set; } = string.Empty;
    public string? SourceBookId { get; set; }
    public string TimePeriod { get; set; } = string.Empty;
    public string ElapsedTime { get; set; } = string.Empty;
    public string KeyTimeEvent { get; set; } = string.Empty;
    public string Importance { get; set; } = "normal";
}

public sealed class LongNovelCompletenessDto
{
    public string ProjectId { get; set; } = string.Empty;
    public bool IsReady { get; set; }
    public int ReadyCount { get; set; }
    public int MissingCount { get; set; }
    public int FatalCount { get; set; }
    public IReadOnlyList<LongNovelCompletenessItemDto> Items { get; set; } = Array.Empty<LongNovelCompletenessItemDto>();
}

public sealed class LongNovelCompletenessItemDto
{
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Status { get; set; } = "missing";
    public int Count { get; set; }
    public string Message { get; set; } = string.Empty;
    public string Route { get; set; } = string.Empty;
}

public sealed class TrackingRebuildRequest
{
    public string ProjectId { get; set; } = string.Empty;
    public string? SourceBookId { get; set; }
}

public sealed class TrackingRebuildResultDto
{
    public string ProjectId { get; set; } = string.Empty;
    public string? SourceBookId { get; set; }
    public int ChapterCount { get; set; }
    public int BlueprintCount { get; set; }
    public int RemovedForeshadowingCount { get; set; }
    public int RemovedTimelineCount { get; set; }
    public int ForeshadowingCount { get; set; }
    public int TimelineCount { get; set; }
}
