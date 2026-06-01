using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Runtime;

/// <summary>
/// 项目级聚合统计（一项目一行）。原 Storage/Projects/.../Config/generation_statistics.json。
/// </summary>
public class GenerationStatistics : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;

    public int TotalGenerations { get; set; }
    public int FirstPassCount { get; set; }
    public int RewriteCount { get; set; }
    public int FailureCount { get; set; }

    public long TotalInputTokens { get; set; }
    public long TotalOutputTokens { get; set; }
    public long TotalCostMicros { get; set; }

    public DateTime LastUpdatedAt { get; set; } = DateTime.UtcNow;
}
