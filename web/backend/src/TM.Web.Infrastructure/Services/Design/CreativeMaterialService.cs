using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Design;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Design;

public class CreativeMaterialService : ICreativeMaterialService
{
    private readonly AppDbContext _db;
    public CreativeMaterialService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<CreativeMaterialDto>> ListAsync(DesignListQuery query, CancellationToken ct = default)
    {
        var rows = await _db.CreativeMaterials.AsQueryable().ApplyFilter(query).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<CreativeMaterialDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.CreativeMaterials.FindAsync(new object?[] { id }, ct);
        return e == null ? null : Map(e);
    }

    public async Task<CreativeMaterialDto> CreateAsync(CreativeMaterialUpsertDto input, CancellationToken ct = default)
    {
        var e = new CreativeMaterial();
        Apply(e, input);
        _db.CreativeMaterials.Add(e);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task<CreativeMaterialDto> UpdateAsync(string id, CreativeMaterialUpsertDto input, CancellationToken ct = default)
    {
        var e = await _db.CreativeMaterials.FindAsync(new object?[] { id }, ct)
                ?? throw new InvalidOperationException("创意素材不存在。");
        Apply(e, input);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.CreativeMaterials.FindAsync(new object?[] { id }, ct);
        if (e == null) return;
        _db.CreativeMaterials.Remove(e);
        await _db.SaveChangesAsync(ct);
    }

    private static void Apply(CreativeMaterial e, CreativeMaterialUpsertDto i)
    {
        if (string.IsNullOrWhiteSpace(i.Name)) throw new InvalidOperationException("名称必填。");
        e.Name = i.Name.Trim();
        e.Category = i.Category ?? "";
        e.CategoryId = string.IsNullOrEmpty(i.CategoryId) ? null : i.CategoryId;
        e.IsEnabled = i.IsEnabled;
        e.SourceBookId = string.IsNullOrEmpty(i.SourceBookId) ? null : i.SourceBookId;
        e.Icon = string.IsNullOrEmpty(i.Icon) ? "💡" : i.Icon;
        e.SourceBookName = i.SourceBookName;
        e.Genre = i.Genre ?? "";
        e.OverallIdea = i.OverallIdea ?? "";
        e.WorldBuildingMethod = i.WorldBuildingMethod ?? "";
        e.PowerSystemDesign = i.PowerSystemDesign ?? "";
        e.EnvironmentDescription = i.EnvironmentDescription ?? "";
        e.FactionDesign = i.FactionDesign ?? "";
        e.WorldviewHighlights = i.WorldviewHighlights ?? "";
        e.ProtagonistDesign = i.ProtagonistDesign ?? "";
        e.SupportingRoles = i.SupportingRoles ?? "";
        e.CharacterRelations = i.CharacterRelations ?? "";
        e.GoldenFingerDesign = i.GoldenFingerDesign ?? "";
        e.CharacterHighlights = i.CharacterHighlights ?? "";
        e.PlotStructure = i.PlotStructure ?? "";
        e.ConflictDesign = i.ConflictDesign ?? "";
        e.ClimaxArrangement = i.ClimaxArrangement ?? "";
        e.ForeshadowingTechnique = i.ForeshadowingTechnique ?? "";
        e.PlotHighlights = i.PlotHighlights ?? "";
    }

    private static CreativeMaterialDto Map(CreativeMaterial e)
        => new(e.Id, e.Name, e.Category, e.CategoryId, e.IsEnabled, e.SourceBookId,
            e.Icon, e.SourceBookName, e.Genre, e.OverallIdea,
            e.WorldBuildingMethod, e.PowerSystemDesign, e.EnvironmentDescription,
            e.FactionDesign, e.WorldviewHighlights,
            e.ProtagonistDesign, e.SupportingRoles, e.CharacterRelations,
            e.GoldenFingerDesign, e.CharacterHighlights,
            e.PlotStructure, e.ConflictDesign, e.ClimaxArrangement,
            e.ForeshadowingTechnique, e.PlotHighlights,
            e.CreatedAt, e.UpdatedAt);
}
