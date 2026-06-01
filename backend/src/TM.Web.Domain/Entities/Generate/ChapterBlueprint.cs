using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Generate;

/// <summary>
/// 章节蓝图。一个 ChapterId 可能对应多条蓝图行（每个 SceneNumber 一行）。
/// </summary>
public class ChapterBlueprint : BusinessDataBase
{
    public Dictionary<string, int> DependencyModuleVersions { get; set; } = new();

    /// <summary>所属章节 ID（Core.Chapter.Id 外键）。</summary>
    public string ChapterId { get; set; } = string.Empty;

    // Tab1: 蓝图概览
    public string OneLineStructure { get; set; } = string.Empty;
    public string PacingCurve { get; set; } = string.Empty;

    // Tab2: 场景列表
    public int SceneNumber { get; set; }
    public string SceneTitle { get; set; } = string.Empty;
    public string PovCharacter { get; set; } = string.Empty;
    public string EstimatedWordCount { get; set; } = string.Empty;
    public string Opening { get; set; } = string.Empty;
    public string Development { get; set; } = string.Empty;
    public string Turning { get; set; } = string.Empty;
    public string Ending { get; set; } = string.Empty;
    public string InfoDrop { get; set; } = string.Empty;

    // Tab3: 要素清单
    public string Cast { get; set; } = string.Empty;
    public string Locations { get; set; } = string.Empty;
    public string Factions { get; set; } = string.Empty;
    public string ItemsClues { get; set; } = string.Empty;
}
