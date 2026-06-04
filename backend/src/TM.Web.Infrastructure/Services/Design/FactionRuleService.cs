using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Design;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Design;

public class FactionRuleService : IFactionRuleService
{
    private readonly AppDbContext _db;
    public FactionRuleService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<FactionRuleDto>> ListAsync(DesignListQuery query, CancellationToken ct = default)
    {
        query = await _db.ResolveProjectScopeAsync(query, ct);
        var rows = await ApplyDefaultOrder(_db.FactionRules.AsQueryable().ApplyFilter(query)).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<PagedResult<FactionRuleDto>> ListPagedAsync(DesignListQuery query, CancellationToken ct = default)
    {
        query = await _db.ResolveProjectScopeAsync(query, ct);
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var filtered = _db.FactionRules.AsQueryable().ApplyFilter(query);
        var total = await filtered.CountAsync(ct);
        var rows = await ApplyDefaultOrder(filtered).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return new PagedResult<FactionRuleDto>(rows.Select(Map).ToList(), total, page, pageSize);
    }

    public async Task<FactionRuleDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.FactionRules.FindAsync(new object?[] { id }, ct);
        return e == null ? null : Map(e);
    }

    public async Task<FactionRuleDto> CreateAsync(FactionRuleUpsertDto input, CancellationToken ct = default)
    {
        var sourceBookId = await _db.ResolveWriteSourceBookIdAsync(input.ProjectId, input.SourceBookId, ct);
        var e = new FactionRule();
        Apply(e, input, sourceBookId);
        _db.FactionRules.Add(e);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task<FactionRuleDto> UpdateAsync(string id, FactionRuleUpsertDto input, CancellationToken ct = default)
    {
        var e = await _db.FactionRules.FindAsync(new object?[] { id }, ct)
                ?? throw new InvalidOperationException("势力规则不存在。");
        var sourceBookId = await _db.ResolveWriteSourceBookIdAsync(input.ProjectId, input.SourceBookId, ct);
        Apply(e, input, sourceBookId);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.FactionRules.FindAsync(new object?[] { id }, ct);
        if (e == null) return;

        // 检查是否被 Location 引用
        var locationRefs = await _db.LocationRules.CountAsync(x => x.FactionId == id, ct);
        if (locationRefs > 0)
            throw new InvalidOperationException($"势力被 {locationRefs} 个地点引用,无法删除。");

        _db.FactionRules.Remove(e);
        await _db.SaveChangesAsync(ct);
    }

    private static void Apply(FactionRule e, FactionRuleUpsertDto i, string? sourceBookId)
    {
        if (string.IsNullOrWhiteSpace(i.Name)) throw new InvalidOperationException("名称必填。");
        e.Name = i.Name.Trim();
        e.Category = i.Category ?? "";
        e.CategoryId = string.IsNullOrEmpty(i.CategoryId) ? null : i.CategoryId;
        e.IsEnabled = i.IsEnabled;
        e.SourceBookId = sourceBookId;
        e.FactionType = i.FactionType ?? "";
        e.Goal = i.Goal ?? "";
        e.StrengthTerritory = i.StrengthTerritory ?? "";
        e.Leader = i.Leader ?? "";
        e.CoreMembers = i.CoreMembers ?? "";
        e.MemberTraits = i.MemberTraits ?? "";
        e.Allies = i.Allies ?? "";
        e.Enemies = i.Enemies ?? "";
        e.NeutralCompetitors = i.NeutralCompetitors ?? "";
    }

    private static IOrderedQueryable<FactionRule> ApplyDefaultOrder(IQueryable<FactionRule> query)
        => query.OrderBy(x => x.Category)
            .ThenBy(x => x.FactionType)
            .ThenBy(x => x.Name);

    private static FactionRuleDto Map(FactionRule e)
        => new(e.Id, e.Name, e.Category, e.CategoryId, e.IsEnabled, e.SourceBookId,
            e.FactionType, e.Goal, e.StrengthTerritory,
            e.Leader, e.CoreMembers, e.MemberTraits,
            e.Allies, e.Enemies, e.NeutralCompetitors,
            e.CreatedAt, e.UpdatedAt);
}
