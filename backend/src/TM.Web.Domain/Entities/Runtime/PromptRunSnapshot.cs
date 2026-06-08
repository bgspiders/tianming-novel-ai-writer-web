using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Runtime;

public class PromptRunSnapshot : EntityBase
{
    public string RunId { get; set; } = string.Empty;

    public string ProjectId { get; set; } = string.Empty;

    public string? ChapterId { get; set; }

    public string? WorkflowId { get; set; }

    public string? StepKey { get; set; }

    public string Source { get; set; } = string.Empty;

    public string Model { get; set; } = string.Empty;

    public float? Temperature { get; set; }

    public int? MaxTokens { get; set; }

    public string ContextHash { get; set; } = string.Empty;

    public string ContextSummary { get; set; } = string.Empty;

    public string PromptSummary { get; set; } = string.Empty;

    public string OutputSummary { get; set; } = string.Empty;

    public bool Success { get; set; }

    public string Error { get; set; } = string.Empty;

    public long ElapsedMs { get; set; }
}
