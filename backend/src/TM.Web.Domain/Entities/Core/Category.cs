using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Core;

/// <summary>
/// 跨模块共用的分类树。原项目每个 ModuleType 下分别存一个 categories.json + built_in_categories.json，
/// Web 化后统一为一张表，按 (ModuleType, ParentId) 组织树形结构。
/// </summary>
public class Category : EntityBase
{
    /// <summary>模块类型，见 ModuleTypes 常量。</summary>
    public string ModuleType { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? ParentId { get; set; }

    public int SortOrder { get; set; }

    public bool IsBuiltIn { get; set; }

    public bool IsEnabled { get; set; } = true;

    /// <summary>SourceBook 隔离键（部分模块按源书分类）。</summary>
    public string? SourceBookId { get; set; }
}
