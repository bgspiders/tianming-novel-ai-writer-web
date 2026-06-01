using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Design;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Design;

public class WorldRuleService : IWorldRuleService
{
    private readonly AppDbContext _db;
    public WorldRuleService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<WorldRuleDto>> ListAsync(DesignListQuery query, CancellationToken ct = default)
    {
        query = await _db.ResolveProjectScopeAsync(query, ct);
        var rows = await _db.WorldRules.AsQueryable().ApplyFilter(query).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<PagedResult<WorldRuleDto>> ListPagedAsync(DesignListQuery query, CancellationToken ct = default)
    {
        query = await _db.ResolveProjectScopeAsync(query, ct);
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var filtered = _db.WorldRules.AsQueryable().ApplyFilter(query);
        var total = await filtered.CountAsync(ct);
        var rows = await filtered.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return new PagedResult<WorldRuleDto>(rows.Select(Map).ToList(), total, page, pageSize);
    }

    public async Task<WorldRuleDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.WorldRules.FindAsync(new object?[] { id }, ct);
        return e == null ? null : Map(e);
    }

    public async Task<WorldRuleDto> CreateAsync(WorldRuleUpsertDto input, CancellationToken ct = default)
    {
        var sourceBookId = await _db.ResolveWriteSourceBookIdAsync(input.ProjectId, input.SourceBookId, ct);
        var e = new WorldRule();
        Apply(e, input, sourceBookId);
        _db.WorldRules.Add(e);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task<WorldRuleDto> UpdateAsync(string id, WorldRuleUpsertDto input, CancellationToken ct = default)
    {
        var e = await _db.WorldRules.FindAsync(new object?[] { id }, ct)
                ?? throw new InvalidOperationException("世界规则不存在。");
        var sourceBookId = await _db.ResolveWriteSourceBookIdAsync(input.ProjectId, input.SourceBookId, ct);
        Apply(e, input, sourceBookId);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.WorldRules.FindAsync(new object?[] { id }, ct);
        if (e == null) return;
        _db.WorldRules.Remove(e);
        await _db.SaveChangesAsync(ct);
    }

    private static void Apply(WorldRule e, WorldRuleUpsertDto i, string? sourceBookId)
    {
        if (string.IsNullOrWhiteSpace(i.Name)) throw new InvalidOperationException("名称必填。");
        e.Name = i.Name.Trim();
        e.Category = i.Category ?? string.Empty;
        e.CategoryId = string.IsNullOrEmpty(i.CategoryId) ? null : i.CategoryId;
        e.IsEnabled = i.IsEnabled;
        e.SourceBookId = sourceBookId;
        e.OneLineSummary = i.OneLineSummary ?? "";
        e.PowerSystem = i.PowerSystem ?? "";
        e.Cosmology = i.Cosmology ?? "";
        e.SpecialLaws = i.SpecialLaws ?? "";
        e.HardRules = i.HardRules ?? "";
        e.SoftRules = i.SoftRules ?? "";
        e.AncientEra = i.AncientEra ?? "";
        e.KeyEvents = i.KeyEvents ?? "";
        e.ModernHistory = i.ModernHistory ?? "";
        e.StatusQuo = i.StatusQuo ?? "";
    }

    private static WorldRuleDto Map(WorldRule e)
        => new(e.Id, e.Name, e.Category, e.CategoryId, e.IsEnabled, e.SourceBookId,
            e.OneLineSummary, e.PowerSystem, e.Cosmology, e.SpecialLaws, e.HardRules, e.SoftRules,
            e.AncientEra, e.KeyEvents, e.ModernHistory, e.StatusQuo,
            e.CreatedAt, e.UpdatedAt);
}
