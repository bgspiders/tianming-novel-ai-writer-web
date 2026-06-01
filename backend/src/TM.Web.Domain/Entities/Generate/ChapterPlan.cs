using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Generate;

/// <summary>
/// 章节规划。每个 ChapterNumber 一条规划记录。
/// </summary>
public class ChapterPlan : BusinessDataBase
{
    public Dictionary<string, int> DependencyModuleVersions { get; set; } = new();

    // Tab1: 章节目标
    public string ChapterTitle { get; set; } = string.Empty;
    public int ChapterNumber { get; set; }
    public string Volume { get; set; } = string.Empty;
    public string EstimatedWordCount { get; set; } = string.Empty;
    public string ChapterTheme { get; set; } = string.Empty;
    public string ReaderExperienceGoal { get; set; } = string.Empty;
    public string MainGoal { get; set; } = string.Empty;

    // Tab2: 冲突与转折
    public string ResistanceSource { get; set; } = string.Empty;
    public string KeyTurn { get; set; } = string.Empty;
    public string Hook { get; set; } = string.Empty;

    // Tab3: 交付物
    public string WorldInfoDrop { get; set; } = string.Empty;
    public string CharacterArcProgress { get; set; } = string.Empty;
    public string MainPlotProgress { get; set; } = string.Empty;
    public string Foreshadowing { get; set; } = string.Empty;

    // Tab4: 出场实体引用
    public List<string> ReferencedCharacterNames { get; set; } = new();
    public List<string> ReferencedFactionNames { get; set; } = new();
    public List<string> ReferencedLocationNames { get; set; } = new();
}
