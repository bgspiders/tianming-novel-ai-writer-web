namespace TM.Web.Application.Dtos.Design;

/// <summary>设计实体共用过滤参数。</summary>
public record DesignListQuery(
    string? CategoryId = null,
    string? SourceBookId = null,
    string? Keyword = null,
    bool? IsEnabled = null);

/// <summary>所有 BusinessDataBase DTO 共有的元字段。</summary>
public interface IBusinessDataDto
{
    string Id { get; }
    string Name { get; }
    string Category { get; }
    string? CategoryId { get; }
    bool IsEnabled { get; }
    string? SourceBookId { get; }
    DateTime CreatedAt { get; }
    DateTime UpdatedAt { get; }
}
