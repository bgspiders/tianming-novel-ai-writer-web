using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Tracking;

/// <summary>
/// 角色关系快照（A → B 在某章节的关系类型与信任值）。
/// </summary>
public class CharacterRelationshipState : EntityBase
{
    public string CharacterStateEntryId { get; set; } = string.Empty;
    public string TargetCharacterName { get; set; } = string.Empty;
    public string ChapterId { get; set; } = string.Empty;

    public string Relation { get; set; } = string.Empty;
    public int Trust { get; set; }

    public CharacterStateEntry? CharacterStateEntry { get; set; }
}
