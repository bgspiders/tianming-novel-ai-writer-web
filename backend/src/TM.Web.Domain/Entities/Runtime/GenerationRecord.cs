using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Runtime;

/// <summary>
/// 章节生成尝试记录。一次生成（含多次重写）一行。
/// FailureStages/Attempts 用 JSON 列保留原始过程数据。
/// </summary>
public class GenerationRecord : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;
    public string ChapterId { get; set; } = string.Empty;

    public bool Success { get; set; }
    public int TotalAttempts { get; set; }
    public int RewriteCount { get; set; }

    /// <summary>失败的门禁阶段名 List 的 JSON 序列化。</summary>
    public string FailureStages { get; set; } = "[]";

    /// <summary>每次尝试的详细信息（耗时、错误、tokens）JSON 数组。</summary>
    public string Attempts { get; set; } = "[]";

    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? FinishedAt { get; set; }
}
