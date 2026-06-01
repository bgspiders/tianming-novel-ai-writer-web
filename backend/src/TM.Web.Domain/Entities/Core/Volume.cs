using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Core;

/// <summary>
/// 分卷。第 N 卷在一本书内 (project_id, volume_number) 唯一。
/// 与 VolumeDesignData（设计数据）不同：volumes 是"已落地"卷，VolumeDesign 是"规划"卷。
/// </summary>
public class Volume : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;

    public int VolumeNumber { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Theme { get; set; }

    /// <summary>原 guides/milestones/vol{N}.txt 的内容，&lt; 12000 字符直接入库。</summary>
    public string? MilestoneText { get; set; }

    public Project? Project { get; set; }

    public ICollection<Chapter> Chapters { get; set; } = new List<Chapter>();
}
