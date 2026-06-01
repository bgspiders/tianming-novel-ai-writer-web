using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Generate;

/// <summary>
/// 分卷规划设计。ReferencedXxxNames 三组用 JSON 列存储。
/// 与 Core.Volume 区别：VolumeDesign 是"规划阶段"的卷设计，Volume 是"已落地"的卷实例。
/// </summary>
public class VolumeDesign : BusinessDataBase
{
    public Dictionary<string, int> DependencyModuleVersions { get; set; } = new();

    // Tab1: 卷定位
    public int VolumeNumber { get; set; }
    public string VolumeTitle { get; set; } = string.Empty;
    public string VolumeTheme { get; set; } = string.Empty;
    public string StageGoal { get; set; } = string.Empty;
    public string EstimatedWordCount { get; set; } = string.Empty;
    public int TargetChapterCount { get; set; }
    public int StartChapter { get; set; }
    public int EndChapter { get; set; }

    // Tab2: 冲突
    public string MainConflict { get; set; } = string.Empty;
    public string PressureSource { get; set; } = string.Empty;
    public string KeyEvents { get; set; } = string.Empty;
    public string OpeningState { get; set; } = string.Empty;
    public string EndingState { get; set; } = string.Empty;

    // Tab3: 章节分配
    public string ChapterAllocationOverview { get; set; } = string.Empty;
    public string PlotAllocation { get; set; } = string.Empty;
    public string ChapterGenerationHints { get; set; } = string.Empty;

    // Tab4: 出场实体引用
    public List<string> ReferencedCharacterNames { get; set; } = new();
    public List<string> ReferencedFactionNames { get; set; } = new();
    public List<string> ReferencedLocationNames { get; set; } = new();
}
