using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Design;

/// <summary>
/// 角色规则。5 Tab × 17 字段，对应原 CharacterRulesData。
/// </summary>
public class CharacterRule : BusinessDataBase
{
    // Tab1: 基本信息（Identity）
    public string CharacterType { get; set; } = string.Empty;
    public string Gender { get; set; } = string.Empty;
    public string Age { get; set; } = string.Empty;
    public string Identity { get; set; } = string.Empty;
    public string Race { get; set; } = string.Empty;
    public string Appearance { get; set; } = string.Empty;

    // Tab2: 人物弧光（Arc）
    public string Want { get; set; } = string.Empty;
    public string Need { get; set; } = string.Empty;
    public string FlawBelief { get; set; } = string.Empty;
    public string GrowthPath { get; set; } = string.Empty;

    // Tab3: 关系
    public string TargetCharacterName { get; set; } = string.Empty;
    public string RelationshipType { get; set; } = string.Empty;
    public string EmotionDynamic { get; set; } = string.Empty;

    // Tab4: 能力
    public string CombatSkills { get; set; } = string.Empty;
    public string NonCombatSkills { get; set; } = string.Empty;
    public string SpecialAbilities { get; set; } = string.Empty;

    // Tab5: 装备
    public string SignatureItems { get; set; } = string.Empty;
    public string CommonItems { get; set; } = string.Empty;
    public string PersonalAssets { get; set; } = string.Empty;
}
