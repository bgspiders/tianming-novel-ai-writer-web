using TM.Web.Application.Dtos.Core;

namespace TM.Web.Application.Services;

public interface ICategoryService
{
    /// <summary>列出指定模块下的所有分类(平铺)。</summary>
    Task<IReadOnlyList<CategoryDto>> ListAsync(string moduleType, string? sourceBookId, string? projectId = null, CancellationToken ct = default);

    /// <summary>按 (ModuleType, ParentId) 构建分类树。</summary>
    Task<IReadOnlyList<CategoryTreeNodeDto>> GetTreeAsync(string moduleType, string? sourceBookId, string? projectId = null, CancellationToken ct = default);

    Task<CategoryDto?> GetAsync(string id, CancellationToken ct = default);
    Task<CategoryDto> CreateAsync(CategoryUpsertDto input, CancellationToken ct = default);
    Task<CategoryDto> UpdateAsync(string id, CategoryUpsertDto input, CancellationToken ct = default);
    Task ReorderAsync(CategoryReorderDto input, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}

public interface ISourceBookService
{
    Task<IReadOnlyList<SourceBookDto>> ListAsync(CancellationToken ct = default);
    Task<SourceBookDto?> GetAsync(string id, CancellationToken ct = default);
    Task<SourceBookDto> CreateAsync(SourceBookUpsertDto input, CancellationToken ct = default);
    Task<SourceBookDto> UpdateAsync(string id, SourceBookUpsertDto input, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}
