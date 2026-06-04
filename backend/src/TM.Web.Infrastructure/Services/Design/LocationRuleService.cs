using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Design;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Design;

public class LocationRuleService : ILocationRuleService
{
    private readonly AppDbContext _db;
    public LocationRuleService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<LocationRuleDto>> ListAsync(DesignListQuery query, CancellationToken ct = default)
    {
        query = await _db.ResolveProjectScopeAsync(query, ct);
        var rows = await ApplyDefaultOrder(_db.LocationRules.AsQueryable().ApplyFilter(query)).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<PagedResult<LocationRuleDto>> ListPagedAsync(DesignListQuery query, CancellationToken ct = default)
    {
        query = await _db.ResolveProjectScopeAsync(query, ct);
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var filtered = _db.LocationRules.AsQueryable().ApplyFilter(query);
        var total = await filtered.CountAsync(ct);
        var rows = await ApplyDefaultOrder(filtered).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return new PagedResult<LocationRuleDto>(rows.Select(Map).ToList(), total, page, pageSize);
    }

    public async Task<LocationRuleDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.LocationRules.FindAsync(new object?[] { id }, ct);
        return e == null ? null : Map(e);
    }

    public async Task<LocationRuleDto> CreateAsync(LocationRuleUpsertDto input, CancellationToken ct = default)
    {
        await ValidateFactionAsync(input.FactionId, ct);
        var sourceBookId = await _db.ResolveWriteSourceBookIdAsync(input.ProjectId, input.SourceBookId, ct);
        var e = new LocationRule();
        Apply(e, input, sourceBookId);
        _db.LocationRules.Add(e);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task<LocationRuleDto> UpdateAsync(string id, LocationRuleUpsertDto input, CancellationToken ct = default)
    {
        var e = await _db.LocationRules.FindAsync(new object?[] { id }, ct)
                ?? throw new InvalidOperationException("地点规则不存在。");
        await ValidateFactionAsync(input.FactionId, ct);
        var sourceBookId = await _db.ResolveWriteSourceBookIdAsync(input.ProjectId, input.SourceBookId, ct);
        Apply(e, input, sourceBookId);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.LocationRules.FindAsync(new object?[] { id }, ct);
        if (e == null) return;
        _db.LocationRules.Remove(e);
        await _db.SaveChangesAsync(ct);
    }

    private async Task ValidateFactionAsync(string? factionId, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(factionId)) return;
        var exists = await _db.FactionRules.AnyAsync(f => f.Id == factionId, ct);
        if (!exists) throw new InvalidOperationException($"势力 {factionId} 不存在。");
    }

    private static void Apply(LocationRule e, LocationRuleUpsertDto i, string? sourceBookId)
    {
        if (string.IsNullOrWhiteSpace(i.Name)) throw new InvalidOperationException("名称必填。");
        e.Name = i.Name.Trim();
        e.Category = i.Category ?? "";
        e.CategoryId = string.IsNullOrEmpty(i.CategoryId) ? null : i.CategoryId;
        e.IsEnabled = i.IsEnabled;
        e.SourceBookId = sourceBookId;
        e.LocationType = i.LocationType ?? "";
        e.Description = i.Description ?? "";
        e.Scale = i.Scale ?? "";
        e.Terrain = i.Terrain ?? "";
        e.Climate = i.Climate ?? "";
        e.Landmarks = i.Landmarks ?? new List<string>();
        e.Resources = i.Resources ?? new List<string>();
        e.HistoricalSignificance = i.HistoricalSignificance ?? "";
        e.Dangers = i.Dangers ?? new List<string>();
        e.FactionId = string.IsNullOrEmpty(i.FactionId) ? null : i.FactionId;
    }

    private static IOrderedQueryable<LocationRule> ApplyDefaultOrder(IQueryable<LocationRule> query)
        => query.OrderBy(x => x.Category)
            .ThenBy(x => x.LocationType)
            .ThenBy(x => x.Name);

    private static LocationRuleDto Map(LocationRule e)
        => new(e.Id, e.Name, e.Category, e.CategoryId, e.IsEnabled, e.SourceBookId,
            e.LocationType, e.Description, e.Scale,
            e.Terrain, e.Climate, e.Landmarks ?? new(), e.Resources ?? new(),
            e.HistoricalSignificance, e.Dangers ?? new(),
            e.FactionId,
            e.CreatedAt, e.UpdatedAt);
}
