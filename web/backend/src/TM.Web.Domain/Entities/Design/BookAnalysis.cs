using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Design;

/// <summary>
/// 智能拆书结果。对应原 BookAnalysisData。
/// 字段构成 = 元信息（被 SourceBook 表覆盖）+ 拆书结论（保留在本表）。
/// 阶段 1 导入时按 SourceBookId 关联到独立 SourceBook 行；老 JSON 的元信息字段在导入时拆出。
/// </summary>
public class BookAnalysis : BusinessDataBase
{
    public string Icon { get; set; } = "📖";

    public string Author { get; set; } = string.Empty;
    public string Genre { get; set; } = string.Empty;
    public string SourceUrl { get; set; } = string.Empty;

    public string SourceBookTitle { get; set; } = string.Empty;
    public string SourceAuthor { get; set; } = string.Empty;
    public string SourceGenre { get; set; } = string.Empty;
    public string SourceKeywords { get; set; } = string.Empty;
    public string SourceSite { get; set; } = string.Empty;

    public int ChapterCount { get; set; }
    public int TotalWordCount { get; set; }
    public DateTime? CrawledAt { get; set; }

    // 拆书结论字段（与 CreativeMaterial 同构，是拆书 → 素材的来源）
    public string WorldBuildingMethod { get; set; } = string.Empty;
    public string PowerSystemDesign { get; set; } = string.Empty;
    public string EnvironmentDescription { get; set; } = string.Empty;
    public string FactionDesign { get; set; } = string.Empty;
    public string WorldviewHighlights { get; set; } = string.Empty;

    public string ProtagonistDesign { get; set; } = string.Empty;
    public string SupportingRoles { get; set; } = string.Empty;
    public string CharacterRelations { get; set; } = string.Empty;
    public string GoldenFingerDesign { get; set; } = string.Empty;
    public string CharacterHighlights { get; set; } = string.Empty;

    public string PlotStructure { get; set; } = string.Empty;
    public string ConflictDesign { get; set; } = string.Empty;
    public string ClimaxArrangement { get; set; } = string.Empty;
    public string ForeshadowingTechnique { get; set; } = string.Empty;
    public string PlotHighlights { get; set; } = string.Empty;
}
