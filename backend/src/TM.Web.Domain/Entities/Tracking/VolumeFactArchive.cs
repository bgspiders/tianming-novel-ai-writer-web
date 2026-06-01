using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Tracking;

/// <summary>
/// 已完结卷的最终事实快照归档（一卷一行）。
/// SnapshotPayload 是 VolumeFactArchive 整体 JSON（角色/势力/伏笔/时间线等所有维度的冻结值），
/// 供下一卷生成时作为"前卷事实归档"参考。详见 Services/Modules/ProjectData/Models/Tracking/VolumeFactArchive.cs。
/// </summary>
public class VolumeFactArchive : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;
    public string VolumeId { get; set; } = string.Empty;
    public int VolumeNumber { get; set; }
    public string LastChapterId { get; set; } = string.Empty;
    public DateTime ArchivedAt { get; set; } = DateTime.UtcNow;

    /// <summary>原 VolumeFactArchive 整体序列化后的 JSON。</summary>
    public string SnapshotPayload { get; set; } = "{}";
}
