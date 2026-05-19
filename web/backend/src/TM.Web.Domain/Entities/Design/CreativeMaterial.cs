using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Design;

/// <summary>
/// 创意素材（模板）。对应原 CreativeMaterialData。
/// 注意原模型用 CreatedTime/ModifiedTime（带 Time 后缀），本表统一改用 EntityBase 的 CreatedAt/UpdatedAt。
/// </summary>
public class CreativeMaterial : BusinessDataBase
{
    public string Icon { get; set; } = "💡";

    public string? SourceBookName { get; set; }

    public string Genre { get; set; } = string.Empty;

    public string OverallIdea { get; set; } = string.Empty;

    // 世界构建
    public string WorldBuildingMethod { get; set; } = string.Empty;
    public string PowerSystemDesign { get; set; } = string.Empty;
    public string EnvironmentDescription { get; set; } = string.Empty;
    public string FactionDesign { get; set; } = string.Empty;
    public string WorldviewHighlights { get; set; } = string.Empty;

    // 角色
    public string ProtagonistDesign { get; set; } = string.Empty;
    public string SupportingRoles { get; set; } = string.Empty;
    public string CharacterRelations { get; set; } = string.Empty;
    public string GoldenFingerDesign { get; set; } = string.Empty;
    public string CharacterHighlights { get; set; } = string.Empty;

    // 剧情
    public string PlotStructure { get; set; } = string.Empty;
    public string ConflictDesign { get; set; } = string.Empty;
    public string ClimaxArrangement { get; set; } = string.Empty;
    public string ForeshadowingTechnique { get; set; } = string.Empty;
    public string PlotHighlights { get; set; } = string.Empty;
}
