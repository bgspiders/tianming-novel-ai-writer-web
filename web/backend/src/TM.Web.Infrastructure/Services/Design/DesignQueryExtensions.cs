using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Design;
using TM.Web.Domain.Common;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Design;

/// <summary>
/// 设计实体的通用 List 过滤 + 关键字搜索骨架。各子类自己写 Map / Apply 即可。
/// </summary>
internal static class DesignQueryExtensions
{
    public static async Task<DesignListQuery> ResolveProjectScopeAsync(
        this AppDbContext db,
        DesignListQuery query,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query.ProjectId))
        {
            return query;
        }

        var sourceBookId = await db.Projects
            .AsNoTracking()
            .Where(p => p.Id == query.ProjectId)
            .Select(p => p.CurrentSourceBookId)
            .FirstOrDefaultAsync(ct);

        return query with
        {
            SourceBookId = string.IsNullOrWhiteSpace(sourceBookId) ? "__tm_no_project_source_book__" : sourceBookId,
            ForceSourceBookScope = true
        };
    }

    public static async Task<string?> ResolveWriteSourceBookIdAsync(
        this AppDbContext db,
        string? projectId,
        string? sourceBookId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(projectId))
        {
            return string.IsNullOrWhiteSpace(sourceBookId) ? null : sourceBookId.Trim();
        }

        var project = await db.Projects
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == projectId, ct)
            ?? throw new InvalidOperationException($"项目 {projectId} 不存在。");

        if (string.IsNullOrWhiteSpace(project.CurrentSourceBookId))
        {
            throw new InvalidOperationException("当前项目未绑定默认源书，无法写入设计数据。");
        }

        return project.CurrentSourceBookId;
    }

    public static IQueryable<T> ApplyFilter<T>(this IQueryable<T> q, DesignListQuery query)
        where T : BusinessDataBase
    {
        if (query.IncludeUncategorized)
        {
            q = q.Where(x => x.CategoryId == null || x.CategoryId == "");
        }
        else if (!string.IsNullOrEmpty(query.CategoryId))
        {
            q = q.Where(x => x.CategoryId == query.CategoryId);
        }

        if (query.ForceSourceBookScope && string.IsNullOrEmpty(query.SourceBookId))
            q = q.Where(x => x.SourceBookId == null || x.SourceBookId == "");
        else if (!string.IsNullOrEmpty(query.SourceBookId))
            q = q.Where(x => x.SourceBookId == query.SourceBookId);

        if (query.IsEnabled.HasValue)
            q = q.Where(x => x.IsEnabled == query.IsEnabled.Value);

        if (query.UpdatedFrom.HasValue)
            q = q.Where(x => x.UpdatedAt >= query.UpdatedFrom.Value);

        if (query.UpdatedTo.HasValue)
            q = q.Where(x => x.UpdatedAt <= query.UpdatedTo.Value);

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var kw = query.Keyword.Trim();
            q = q.Where(x => EF.Functions.Like(x.Name, $"%{kw}%"));
        }

        return q.OrderByDescending(x => x.UpdatedAt);
    }
}
