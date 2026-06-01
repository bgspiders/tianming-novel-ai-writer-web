using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Indexing;

/// <summary>
/// 层级完成状态。原 Storage/Projects/.../Config/layer_completion_status.json。
/// 每项目 5 行（5 个 layer，见 CompletionLayers 常量）。
/// </summary>
public class LayerCompletionStatus : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;

    /// <summary>层名，见 CompletionLayers 常量（design/outline/volume_design/chapter_plan/blueprint）。</summary>
    public string Layer { get; set; } = string.Empty;

    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }

    public int DataVersion { get; set; }
    public int SummaryVersion { get; set; }
}
