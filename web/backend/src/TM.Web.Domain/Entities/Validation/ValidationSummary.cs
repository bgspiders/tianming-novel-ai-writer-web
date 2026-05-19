using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Validation;

/// <summary>
/// 项目级或卷级的统一校验汇总。ModuleResults/ProblemItems 用 JSON 列。
/// 原 Storage/Modules/Validate/ValidationSummary/data/{id}.json。
/// </summary>
public class ValidationSummary : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;

    /// <summary>目标卷号；0 表示项目全书级。</summary>
    public int TargetVolumeNumber { get; set; }

    public string OverallResult { get; set; } = "passed";

    public string ModuleResults { get; set; } = "{}";

    public string ProblemItems { get; set; } = "[]";

    public DateTime LastValidatedAt { get; set; } = DateTime.UtcNow;
}
