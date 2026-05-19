using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Services;
using TM.Web.Domain.Common;
using TM.Web.Domain.Entities.Core;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Core;

public class CategoryService : ICategoryService
{
    private readonly AppDbContext _db;

    public CategoryService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<CategoryDto>> ListAsync(string moduleType, string? sourceBookId, CancellationToken ct = default)
    {
        var rows = await Query(moduleType, sourceBookId).OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync(ct);
        var counts = await CountItemsByCategoryAsync(moduleType, sourceBookId, ct);
        return rows.Select(c => ToDto(c, counts.GetValueOrDefault(c.Id))).ToList();
    }

    public async Task<IReadOnlyList<CategoryTreeNodeDto>> GetTreeAsync(string moduleType, string? sourceBookId, CancellationToken ct = default)
    {
        var rows = await Query(moduleType, sourceBookId).ToListAsync(ct);
        var counts = await CountItemsByCategoryAsync(moduleType, sourceBookId, ct);

        var nodes = rows.ToDictionary(
            c => c.Id,
            c => new CategoryTreeNodeDto(
                c.Id, c.ModuleType, c.Name, c.ParentId, c.SortOrder,
                c.IsBuiltIn, c.IsEnabled, c.SourceBookId,
                counts.GetValueOrDefault(c.Id),
                new List<CategoryTreeNodeDto>()));

        var roots = new List<CategoryTreeNodeDto>();
        foreach (var node in nodes.Values)
        {
            if (!string.IsNullOrEmpty(node.ParentId) && nodes.TryGetValue(node.ParentId, out var parent))
            {
                parent.Children.Add(node);
            }
            else
            {
                roots.Add(node);
            }
        }

        SortRecursive(roots);
        return roots;

        static void SortRecursive(List<CategoryTreeNodeDto> list)
        {
            list.Sort((a, b) =>
            {
                var c = a.SortOrder.CompareTo(b.SortOrder);
                return c != 0 ? c : string.Compare(a.Name, b.Name, StringComparison.Ordinal);
            });
            foreach (var n in list) SortRecursive(n.Children);
        }
    }

    public async Task<CategoryDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var c = await _db.Categories.FindAsync(new object?[] { id }, ct);
        if (c == null) return null;
        var count = await CountItemsAsync(c.ModuleType, c.Id, c.SourceBookId, ct);
        return ToDto(c, count);
    }

    public async Task<CategoryDto> CreateAsync(CategoryUpsertDto input, CancellationToken ct = default)
    {
        var entity = new Category
        {
            ModuleType = input.ModuleType,
            Name = input.Name,
            ParentId = string.IsNullOrEmpty(input.ParentId) ? null : input.ParentId,
            SortOrder = input.SortOrder,
            IsEnabled = input.IsEnabled,
            IsBuiltIn = false,
            SourceBookId = string.IsNullOrEmpty(input.SourceBookId) ? null : input.SourceBookId,
        };
        _db.Categories.Add(entity);
        await _db.SaveChangesAsync(ct);
        return ToDto(entity, 0);
    }

    public async Task<CategoryDto> UpdateAsync(string id, CategoryUpsertDto input, CancellationToken ct = default)
    {
        var entity = await _db.Categories.FindAsync(new object?[] { id }, ct)
                     ?? throw new InvalidOperationException("分类不存在。");

        if (!string.IsNullOrEmpty(input.ParentId) && input.ParentId == id)
            throw new InvalidOperationException("不能将自身设为父分类。");

        entity.Name = input.Name;
        entity.ParentId = string.IsNullOrEmpty(input.ParentId) ? null : input.ParentId;
        entity.SortOrder = input.SortOrder;
        entity.IsEnabled = input.IsEnabled;
        // ModuleType / SourceBookId 不允许跨模块迁移,保持不变

        await _db.SaveChangesAsync(ct);
        var count = await CountItemsAsync(entity.ModuleType, entity.Id, entity.SourceBookId, ct);
        return ToDto(entity, count);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var entity = await _db.Categories.FindAsync(new object?[] { id }, ct);
        if (entity == null) return;
        if (entity.IsBuiltIn)
            throw new InvalidOperationException("内置分类不可删除,可改为禁用。");

        var hasChildren = await _db.Categories.AnyAsync(c => c.ParentId == id, ct);
        if (hasChildren)
            throw new InvalidOperationException("分类下还有子分类,请先删除子分类。");

        // 跨源书检查:只要还有任何实体绑定了这个 CategoryId 就拒绝删除
        var inUse = await CountAllItemsAsync(entity.ModuleType, entity.Id, ct);
        if (inUse > 0)
            throw new InvalidOperationException($"分类下还有 {inUse} 条数据,无法删除。");

        _db.Categories.Remove(entity);
        await _db.SaveChangesAsync(ct);
    }

    private async Task<int> CountAllItemsAsync(string moduleType, string categoryId, CancellationToken ct)
    {
        return moduleType switch
        {
            ModuleTypes.WorldRules => await _db.WorldRules.CountAsync(x => x.CategoryId == categoryId, ct),
            ModuleTypes.CharacterRules => await _db.CharacterRules.CountAsync(x => x.CategoryId == categoryId, ct),
            ModuleTypes.FactionRules => await _db.FactionRules.CountAsync(x => x.CategoryId == categoryId, ct),
            ModuleTypes.LocationRules => await _db.LocationRules.CountAsync(x => x.CategoryId == categoryId, ct),
            ModuleTypes.PlotRules => await _db.PlotRules.CountAsync(x => x.CategoryId == categoryId, ct),
            ModuleTypes.CreativeMaterials => await _db.CreativeMaterials.CountAsync(x => x.CategoryId == categoryId, ct),
            ModuleTypes.BookAnalyses => await _db.BookAnalyses.CountAsync(x => x.CategoryId == categoryId, ct),
            // PromptTemplate 用字符串 Category(name) 匹配
            ModuleTypes.PromptTemplates => await CountPromptTemplatesByCategoryAsync(categoryId, ct),
            _ => 0,
        };
    }

    private async Task<int> CountPromptTemplatesByCategoryAsync(string categoryId, CancellationToken ct)
    {
        var category = await _db.Categories.FindAsync(new object?[] { categoryId }, ct);
        if (category == null) return 0;
        return await _db.PromptTemplates.CountAsync(p => p.Category == category.Name, ct);
    }

    private IQueryable<Category> Query(string moduleType, string? sourceBookId)
    {
        var q = _db.Categories.AsQueryable().Where(c => c.ModuleType == moduleType);
        if (!string.IsNullOrEmpty(sourceBookId))
        {
            q = q.Where(c => c.SourceBookId == sourceBookId || c.SourceBookId == null);
        }
        return q;
    }

    private async Task<Dictionary<string, int>> CountItemsByCategoryAsync(string moduleType, string? sourceBookId, CancellationToken ct)
    {
        return moduleType switch
        {
            ModuleTypes.WorldRules => await GroupCountAsync(_db.WorldRules.AsQueryable(), sourceBookId, ct),
            ModuleTypes.CharacterRules => await GroupCountAsync(_db.CharacterRules.AsQueryable(), sourceBookId, ct),
            ModuleTypes.FactionRules => await GroupCountAsync(_db.FactionRules.AsQueryable(), sourceBookId, ct),
            ModuleTypes.LocationRules => await GroupCountAsync(_db.LocationRules.AsQueryable(), sourceBookId, ct),
            ModuleTypes.PlotRules => await GroupCountAsync(_db.PlotRules.AsQueryable(), sourceBookId, ct),
            ModuleTypes.CreativeMaterials => await GroupCountAsync(_db.CreativeMaterials.AsQueryable(), sourceBookId, ct),
            ModuleTypes.BookAnalyses => await GroupCountAsync(_db.BookAnalyses.AsQueryable(), sourceBookId, ct),
            ModuleTypes.PromptTemplates => await CountPromptsByCategoryNameAsync(ct),
            _ => new Dictionary<string, int>(),
        };
    }

    /// <summary>
    /// PromptTemplate 用字符串 Category(name) 而非 CategoryId,按分类名匹配统计。
    /// </summary>
    private async Task<Dictionary<string, int>> CountPromptsByCategoryNameAsync(CancellationToken ct)
    {
        var categoryIdByName = await _db.Categories
            .Where(c => c.ModuleType == ModuleTypes.PromptTemplates)
            .Select(c => new { c.Id, c.Name })
            .ToListAsync(ct);

        var promptCountByName = await _db.PromptTemplates
            .Where(p => p.Category != null && p.Category != "")
            .GroupBy(p => p.Category)
            .Select(g => new { Name = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Name, x => x.Count, ct);

        var result = new Dictionary<string, int>();
        foreach (var c in categoryIdByName)
        {
            if (promptCountByName.TryGetValue(c.Name, out var count))
                result[c.Id] = count;
        }
        return result;
    }

    private static async Task<Dictionary<string, int>> GroupCountAsync<T>(IQueryable<T> q, string? sourceBookId, CancellationToken ct)
        where T : BusinessDataBase
    {
        if (!string.IsNullOrEmpty(sourceBookId))
            q = q.Where(x => x.SourceBookId == sourceBookId);
        return await q
            .Where(x => x.CategoryId != null)
            .GroupBy(x => x.CategoryId!)
            .Select(g => new { Key = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);
    }

    private async Task<int> CountItemsAsync(string moduleType, string categoryId, string? sourceBookId, CancellationToken ct)
    {
        var dict = await CountItemsByCategoryAsync(moduleType, sourceBookId, ct);
        return dict.GetValueOrDefault(categoryId);
    }

    private static CategoryDto ToDto(Category c, int itemCount)
        => new(c.Id, c.ModuleType, c.Name, c.ParentId, c.SortOrder,
            c.IsBuiltIn, c.IsEnabled, c.SourceBookId, itemCount);
}
