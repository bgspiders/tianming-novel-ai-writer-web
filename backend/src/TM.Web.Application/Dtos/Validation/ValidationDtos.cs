namespace TM.Web.Application.Dtos.Validation;

public sealed record ValidationRunRequest(
    string ProjectId,
    int? VolumeNumber = null);

public sealed record ValidationSummaryDto(
    string Id,
    string ProjectId,
    int TargetVolumeNumber,
    string LastRunId,
    string OverallResult,
    string ModuleResults,
    string ProblemItems,
    DateTime LastValidatedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record ValidationReportDto(
    string Id,
    string ProjectId,
    string ChapterId,
    string RunId,
    int ChapterNumber,
    string ChapterTitle,
    string ChapterStatus,
    DateTime ValidatedAt,
    string Result,
    string Summary,
    IReadOnlyList<ValidationItemDto> Items,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record ValidationItemDto(
    string Id,
    string ValidationType,
    string Name,
    string Result,
    string Details,
    string Suggestion);

public sealed record ValidationReportStatusUpdateRequest(
    string Status,
    string? Note = null);

public sealed record ValidationReportStatusUpdateResult(
    string ReportId,
    string ProjectId,
    string ChapterId,
    string ChapterStatus,
    string? Note,
    DateTime UpdatedAt);

public sealed record FactSnapshotDto(
    string ProjectId,
    int? VolumeNumber,
    FactSnapshotOverviewDto Overview,
    IReadOnlyList<FactSnapshotSectionDto> Sections,
    IReadOnlyList<FactTimelineDto> Timelines,
    IReadOnlyList<VolumeFactArchiveDto> VolumeArchives);

public sealed record FactSnapshotOverviewDto(
    int ChapterCount,
    int TimelineCount,
    int CharacterStateCount,
    int CharacterStatePointCount,
    int CharacterDescriptionCount,
    int ConflictProgressCount,
    int ConflictProgressPointCount,
    int FactionStateCount,
    int FactionStatePointCount,
    int LocationStateCount,
    int LocationStatePointCount,
    int LocationDescriptionCount,
    int WorldRuleConstraintCount,
    int CharacterLocationCount,
    int CharacterMovementCount,
    int ItemStateCount,
    int ItemStatePointCount,
    int ForeshadowingCount,
    int UnresolvedForeshadowingCount,
    int OverdueForeshadowingCount,
    int PlotPointCount,
    int VolumeArchiveCount);

public sealed record FactSnapshotSectionDto(
    string Key,
    string Title,
    int TotalCount,
    string Summary,
    IReadOnlyList<FactSnapshotItemDto> Items);

public sealed record FactSnapshotItemDto(
    string Id,
    string Name,
    string Status,
    string Detail,
    int? ChapterNumber,
    string Importance);

public sealed record FactTimelineDto(
    string Id,
    string ChapterId,
    int ChapterNumber,
    string ChapterTitle,
    string TimePeriod,
    string ElapsedTime,
    string KeyTimeEvent,
    string Importance);

public sealed record VolumeFactArchiveDto(
    string Id,
    string VolumeId,
    int VolumeNumber,
    string LastChapterId,
    DateTime ArchivedAt,
    string SnapshotPayload);
