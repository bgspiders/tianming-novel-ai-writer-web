namespace TM.Web.Domain.Common;

/// <summary>
/// 分类树所属的"模块"枚举字符串常量。用于 categories 表的 module_type 列。
/// 命名与原 Storage 目录一致，便于阶段 1 数据导入工具识别。
/// </summary>
public static class ModuleTypes
{
    public const string WorldRules = "world_rules";
    public const string CharacterRules = "character_rules";
    public const string FactionRules = "faction_rules";
    public const string LocationRules = "location_rules";
    public const string PlotRules = "plot_rules";
    public const string CreativeMaterials = "creative_materials";
    public const string BookAnalyses = "book_analyses";

    public const string Outlines = "outlines";
    public const string VolumeDesigns = "volume_designs";
    public const string ChapterPlans = "chapter_plans";
    public const string ChapterBlueprints = "chapter_blueprints";

    public const string PromptTemplates = "prompt_templates";
}

/// <summary>
/// LayerCompletionStatus 的 layer 枚举（5 个 layer）。对应原 GlobalSummary 的层归集。
/// </summary>
public static class CompletionLayers
{
    public const string Design = "design";
    public const string Outline = "outline";
    public const string VolumeDesign = "volume_design";
    public const string ChapterPlan = "chapter_plan";
    public const string Blueprint = "blueprint";
}
