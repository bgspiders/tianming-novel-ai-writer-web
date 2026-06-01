using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Indexing;

/// <summary>
/// 全书摘要缓存（按项目）。原 Storage/Projects/.../Config/global_summary.json。
/// </summary>
public class GlobalSummaryCache : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;

    /// <summary>原 GlobalSummary 对象的 JSON 序列化。</summary>
    public string Payload { get; set; } = "{}";

    public DateTime ComputedAt { get; set; } = DateTime.UtcNow;

    /// <summary>缓存的数据版本号（用于失效）。</summary>
    public int DataVersion { get; set; }
}
