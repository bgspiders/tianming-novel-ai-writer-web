namespace TM.Web.Application.Dtos.Core;

public record CategoryDto(
    string Id,
    string ModuleType,
    string Name,
    string? ParentId,
    int SortOrder,
    bool IsBuiltIn,
    bool IsEnabled,
    string? SourceBookId,
    int ItemCount);

public record CategoryTreeNodeDto(
    string Id,
    string ModuleType,
    string Name,
    string? ParentId,
    int SortOrder,
    bool IsBuiltIn,
    bool IsEnabled,
    string? SourceBookId,
    int ItemCount,
    List<CategoryTreeNodeDto> Children);

public record CategoryUpsertDto(
    string ModuleType,
    string Name,
    string? ParentId,
    int SortOrder = 0,
    bool IsEnabled = true,
    string? SourceBookId = null,
    string? ProjectId = null);

public record CategoryReorderItemDto(
    string Id,
    string? ParentId,
    int SortOrder);

public record CategoryReorderDto(
    string ModuleType,
    string? SourceBookId,
    string? ProjectId,
    IReadOnlyList<CategoryReorderItemDto> Items);
