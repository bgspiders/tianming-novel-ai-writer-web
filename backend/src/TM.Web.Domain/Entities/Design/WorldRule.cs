using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Design;

/// <summary>
/// 世界观规则。对应原 WorldRulesData，字段一一映射。
/// </summary>
public class WorldRule : BusinessDataBase
{
    // Tab1: 核心设定
    public string OneLineSummary { get; set; } = string.Empty;
    public string PowerSystem { get; set; } = string.Empty;
    public string Cosmology { get; set; } = string.Empty;
    public string SpecialLaws { get; set; } = string.Empty;
    public string HardRules { get; set; } = string.Empty;
    public string SoftRules { get; set; } = string.Empty;

    // Tab2: 历史/时间线
    public string AncientEra { get; set; } = string.Empty;
    public string KeyEvents { get; set; } = string.Empty;
    public string ModernHistory { get; set; } = string.Empty;
    public string StatusQuo { get; set; } = string.Empty;
}
