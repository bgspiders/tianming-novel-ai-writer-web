namespace TM.Web.Domain.Common;

/// <summary>
/// 所有持久化实体的根抽象：纯字符串主键（沿用原项目 GUID 字符串习惯）+ 时间戳。
/// </summary>
public abstract class EntityBase
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
