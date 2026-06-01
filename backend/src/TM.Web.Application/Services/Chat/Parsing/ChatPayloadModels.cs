namespace TM.Web.Application.Services.Chat.Parsing;

public sealed record ChatToolPayload(
    string Type,
    string? TargetPanel = null,
    bool HideRawContentInBubble = false,
    bool AnalysisExpandedByDefault = false,
    bool RequiresExecutionEngine = false,
    string? Description = null,
    IReadOnlyList<PlanStepPayload>? Steps = null,
    int? StepCount = null,
    IReadOnlyList<ToolCallRecordPayload>? ExecutionTrace = null,
    ExecutionTraceSummaryPayload? ExecutionTraceSummary = null,
    IReadOnlyList<ToolCallRecordPayload>? ToolCalls = null,
    IReadOnlyList<ThinkingBlockPayload>? ThinkingBlocks = null,
    ChapterDirectivePayload? Directive = null,
    ChapterRangePayload? ChapterRange = null,
    string? Normalization = null);

public sealed record PlanStepPayload(
    int Index,
    string Title,
    string Detail = "",
    int? ChapterNumber = null,
    string? ContinueFromChapterId = null,
    string? RewriteTargetChapterId = null);

public sealed record ThinkingBlockPayload(
    int Index,
    string Title,
    string Detail);

public sealed record ChapterDirectivePayload(
    string Kind,
    string ChapterId);

public sealed record ChapterRangePayload(
    int Start,
    int End);

public sealed record ToolCallRecordPayload(
    int StepIndex,
    string PluginName,
    string FunctionName,
    string Title,
    string Arguments = "",
    string Result = "",
    string Status = "pending",
    DateTime? StartTime = null,
    DateTime? EndTime = null,
    string? ErrorMessage = null)
{
    public double? DurationSeconds
        => StartTime.HasValue && EndTime.HasValue
            ? (EndTime.Value - StartTime.Value).TotalSeconds
            : null;
}

public sealed record ExecutionTraceSummaryPayload(
    int TotalSteps,
    int CompletedSteps,
    int FailedSteps,
    double TotalDurationSeconds,
    IReadOnlyList<string>? FailedStepSummaries = null)
{
    public string SummaryText
    {
        get
        {
            var text = $"共 {TotalSteps} 步";
            if (FailedSteps > 0) text += $"（{FailedSteps} 失败）";
            if (TotalDurationSeconds > 0) text += $"，耗时 {TotalDurationSeconds:F1}s";
            return text;
        }
    }
}

public sealed record PlanParseResult(
    IReadOnlyList<PlanStepPayload> Steps,
    string? Normalization = null,
    ChapterRangePayload? ChapterRange = null);
