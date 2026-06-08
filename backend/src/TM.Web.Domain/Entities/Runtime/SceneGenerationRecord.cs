using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Runtime;

public class SceneGenerationRecord : EntityBase
{
    public string RunId { get; set; } = string.Empty;

    public string ProjectId { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;

    public int SceneNumber { get; set; }

    public string SceneTitle { get; set; } = string.Empty;

    public string Model { get; set; } = string.Empty;

    public string PromptSnapshot { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public bool Success { get; set; }

    public string Error { get; set; } = string.Empty;

    public int CharCount { get; set; }

    public long ElapsedMs { get; set; }

    public string? FinishReason { get; set; }
}
