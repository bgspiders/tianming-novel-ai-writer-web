namespace TM.Web.Domain.Common;

/// <summary>
/// 设计 / 生成层业务实体共有列。对应原项目 BusinessDataBase（Services/Modules/ProjectData/Models/Common/BusinessDataBase.cs）。
/// SourceBookId 用于按"源书"做范围隔离（拆书 → 创意素材 → 五大规则）。
/// </summary>
public abstract class BusinessDataBase : EntityBase
{
    public string Name { get; set; } = string.Empty;

    /// <summary>对应原文本字段，迁移期保留以兼容旧 JSON 导入；新代码应使用 CategoryId。</summary>
    public string Category { get; set; } = string.Empty;

    public string? CategoryId { get; set; }

    public bool IsEnabled { get; set; } = true;

    public string? SourceBookId { get; set; }
}
