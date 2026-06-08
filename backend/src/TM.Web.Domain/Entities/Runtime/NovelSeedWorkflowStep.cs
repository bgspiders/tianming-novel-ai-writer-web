using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Runtime;

public class NovelSeedWorkflowStep : EntityBase
{
    public string WorkflowId { get; set; } = string.Empty;

    public string StepKey { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public int SortOrder { get; set; }

    public string Status { get; set; } = "pending";

    public string Prompt { get; set; } = string.Empty;

    public string Output { get; set; } = string.Empty;

    public string Error { get; set; } = string.Empty;

    public bool IsConfirmed { get; set; }

    public DateTime? StartedAt { get; set; }

    public DateTime? FinishedAt { get; set; }
}
