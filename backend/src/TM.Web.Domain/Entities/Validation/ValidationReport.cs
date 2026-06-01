using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Validation;

/// <summary>
/// 章节校验报告（每个章节每次校验一行）。原 Storage/Projects/.../Validation/reports/{chapterId}/{ts}_{id}.json。
/// </summary>
public class ValidationReport : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;
    public string ChapterId { get; set; } = string.Empty;
    public string RunId { get; set; } = string.Empty;
    public DateTime ValidatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>整体结果：passed / warning / failed。</summary>
    public string Result { get; set; } = "passed";

    public string Summary { get; set; } = string.Empty;

    public ICollection<ValidationItem> Items { get; set; } = new List<ValidationItem>();
}

/// <summary>
/// 校验报告的具体项（一个 type 一行）。
/// </summary>
public class ValidationItem : EntityBase
{
    public string ValidationReportId { get; set; } = string.Empty;

    /// <summary>校验类型：consistency / reference / rule / quality / etc.</summary>
    public string ValidationType { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public string Result { get; set; } = "passed";
    public string Details { get; set; } = string.Empty;
    public string Suggestion { get; set; } = string.Empty;

    public ValidationReport? ValidationReport { get; set; }
}
