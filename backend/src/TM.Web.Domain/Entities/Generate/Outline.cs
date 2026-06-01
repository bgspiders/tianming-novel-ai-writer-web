using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Generate;

/// <summary>
/// 大纲。DependencyModuleVersions 用 JSON 列存储（数据模型映射.md 节 2.3）。
/// </summary>
public class Outline : BusinessDataBase
{
    /// <summary>记录依赖各模块的数据版本，用于检测设计层变动后大纲是否需要重生成。</summary>
    public Dictionary<string, int> DependencyModuleVersions { get; set; } = new();

    // Tab1: 全书定位
    public int TotalChapterCount { get; set; }
    public string EstimatedWordCount { get; set; } = string.Empty;
    public string OneLineOutline { get; set; } = string.Empty;
    public string EmotionalTone { get; set; } = string.Empty;
    public string PhilosophicalMotif { get; set; } = string.Empty;

    // Tab2: 主题内核
    public string Theme { get; set; } = string.Empty;
    public string CoreConflict { get; set; } = string.Empty;
    public string EndingState { get; set; } = string.Empty;

    // Tab3: 结构规划
    public string VolumeDivision { get; set; } = string.Empty;
    public string OutlineOverview { get; set; } = string.Empty;
}
