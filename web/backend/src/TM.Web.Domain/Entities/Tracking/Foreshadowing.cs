using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Tracking;

/// <summary>
/// 伏笔状态。Tier 分级：Tier-1（重要主线）、Tier-2（重要支线）、Tier-3（普通）。
/// </summary>
public class Foreshadowing : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;
    public string? SourceBookId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Tier { get; set; } = "Tier-3";

    public bool IsSetup { get; set; }
    public bool IsResolved { get; set; }
    public bool IsOverdue { get; set; }

    public string ExpectedSetupChapter { get; set; } = string.Empty;
    public string ExpectedPayoffChapter { get; set; } = string.Empty;
    public string ActualSetupChapter { get; set; } = string.Empty;
    public string ActualPayoffChapter { get; set; } = string.Empty;

    /// <summary>逾期时 AI 建议的处理方案。</summary>
    public string OverdueSuggestion { get; set; } = string.Empty;
}
