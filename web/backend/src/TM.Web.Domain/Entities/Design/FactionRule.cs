using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Design;

/// <summary>
/// 势力规则。对应原 FactionRulesData。
/// </summary>
public class FactionRule : BusinessDataBase
{
    // Tab1: 基本信息
    public string FactionType { get; set; } = string.Empty;
    public string Goal { get; set; } = string.Empty;
    public string StrengthTerritory { get; set; } = string.Empty;

    // Tab2: 核心成员
    public string Leader { get; set; } = string.Empty;
    public string CoreMembers { get; set; } = string.Empty;
    public string MemberTraits { get; set; } = string.Empty;

    // Tab3: 对外关系
    public string Allies { get; set; } = string.Empty;
    public string Enemies { get; set; } = string.Empty;
    public string NeutralCompetitors { get; set; } = string.Empty;
}
