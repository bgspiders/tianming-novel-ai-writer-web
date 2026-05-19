using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Tracking;

/// <summary>
/// 角色当前位置（每角色一行，逐章更新）。
/// </summary>
public class CharacterLocation : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;
    public string CharacterName { get; set; } = string.Empty;
    public string? SourceBookId { get; set; }

    public string CurrentLocation { get; set; } = string.Empty;
    public string LastUpdatedChapter { get; set; } = string.Empty;
}

/// <summary>
/// 角色移动记录（一次移动一行）。
/// </summary>
public class CharacterMovement : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;
    public string CharacterName { get; set; } = string.Empty;
    public string ChapterId { get; set; } = string.Empty;
    public string? SourceBookId { get; set; }

    public string FromLocation { get; set; } = string.Empty;
    public string ToLocation { get; set; } = string.Empty;
    public string Importance { get; set; } = "normal";
}
