using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Indexing;

/// <summary>
/// 实体关系强度索引（无向）。Id1/Id2 按字典序存放，避免重复行。
/// 用于召回链选定相关实体时的快速查询。
/// </summary>
public class RelationStrengthIndex : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;

    public string EntityId1 { get; set; } = string.Empty;
    public string EntityId2 { get; set; } = string.Empty;

    /// <summary>关系强度 0-100。</summary>
    public int Strength { get; set; }
}
