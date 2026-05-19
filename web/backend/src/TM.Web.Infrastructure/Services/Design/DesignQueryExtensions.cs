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
    public static IQueryable<T> ApplyFilter<T>(this IQueryable<T> q, DesignListQuery query)
        where T : BusinessDataBase
    {
        if (!string.IsNullOrEmpty(query.CategoryId))
            q = q.Where(x => x.CategoryId == query.CategoryId);

        if (!string.IsNullOrEmpty(query.SourceBookId))
            q = q.Where(x => x.SourceBookId == query.SourceBookId);

        if (query.IsEnabled.HasValue)
            q = q.Where(x => x.IsEnabled == query.IsEnabled.Value);

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var kw = query.Keyword.Trim();
            q = q.Where(x => EF.Functions.Like(x.Name, $"%{kw}%"));
        }

        return q.OrderByDescending(x => x.UpdatedAt);
    }
}
