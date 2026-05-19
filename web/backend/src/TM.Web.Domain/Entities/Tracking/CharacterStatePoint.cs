using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Tracking;

/// <summary>
/// 角色状态时间点（一章一行）。Abilities 用 JSON 列。
/// </summary>
public class CharacterStatePoint : EntityBase
{
    public string CharacterStateEntryId { get; set; } = string.Empty;
    public string ChapterId { get; set; } = string.Empty;

    public string Phase { get; set; } = string.Empty;
    public string Level { get; set; } = string.Empty;
    public List<string> Abilities { get; set; } = new();
    public string MentalState { get; set; } = string.Empty;
    public string KeyEvent { get; set; } = string.Empty;
    public string Importance { get; set; } = "normal";

    public CharacterStateEntry? CharacterStateEntry { get; set; }
}
