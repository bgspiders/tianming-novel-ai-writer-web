using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Tracking;

/// <summary>
/// 角色追踪入口（一角色一行）。BaseProfile 是建立追踪时的画像快照。
/// CharacterId 对应 Design.CharacterRule.Id；某些 AI 生成的次要角色可能没有 CharacterRule，则只在本表存在。
/// </summary>
public class CharacterStateEntry : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;
    public string CharacterId { get; set; } = string.Empty;
    public string? SourceBookId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string BaseProfile { get; set; } = string.Empty;
    public List<string> DriftWarnings { get; set; } = new();

    public ICollection<CharacterStatePoint> StateHistory { get; set; } = new List<CharacterStatePoint>();
    public ICollection<CharacterRelationshipState> Relationships { get; set; } = new List<CharacterRelationshipState>();
}
