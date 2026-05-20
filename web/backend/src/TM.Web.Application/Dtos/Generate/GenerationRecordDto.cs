namespace TM.Web.Application.Dtos.Generate;

public sealed record GenerationRecordDto(
    string Id,
    string ProjectId,
    string ChapterId,
    bool Success,
    int TotalAttempts,
    int RewriteCount,
    string FailureStages,
    string Attempts,
    DateTime StartedAt,
    DateTime? FinishedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record GenerationStatisticsDto(
    string Id,
    string ProjectId,
    int TotalGenerations,
    int FirstPassCount,
    int RewriteCount,
    int FailureCount,
    long TotalInputTokens,
    long TotalOutputTokens,
    long TotalCostMicros,
    DateTime LastUpdatedAt);
