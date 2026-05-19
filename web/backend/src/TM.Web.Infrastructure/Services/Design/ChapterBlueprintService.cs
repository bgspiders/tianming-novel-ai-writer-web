using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Design;

public class ChapterBlueprintService : IChapterBlueprintService
{
    private readonly AppDbContext _db;
    public ChapterBlueprintService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<ChapterBlueprintDto>> ListAsync(DesignListQuery query, CancellationToken ct = default)
    {
        var rows = await _db.ChapterBlueprints.AsQueryable().ApplyFilter(query).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<ChapterBlueprintDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.ChapterBlueprints.FindAsync(new object?[] { id }, ct);
        return e == null ? null : Map(e);
    }

    public async Task<ChapterBlueprintDto> CreateAsync(ChapterBlueprintUpsertDto input, CancellationToken ct = default)
    {
        var e = new ChapterBlueprint();
        Apply(e, input);
        _db.ChapterBlueprints.Add(e);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task<ChapterBlueprintDto> UpdateAsync(string id, ChapterBlueprintUpsertDto input, CancellationToken ct = default)
    {
        var e = await _db.ChapterBlueprints.FindAsync(new object?[] { id }, ct)
                ?? throw new InvalidOperationException("章节蓝图不存在。");
        Apply(e, input);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.ChapterBlueprints.FindAsync(new object?[] { id }, ct);
        if (e == null) return;
        _db.ChapterBlueprints.Remove(e);
        await _db.SaveChangesAsync(ct);
    }

    private static void Apply(ChapterBlueprint e, ChapterBlueprintUpsertDto i)
    {
        if (string.IsNullOrWhiteSpace(i.Name)) throw new InvalidOperationException("名称必填。");
        e.Name = i.Name.Trim();
        e.Category = i.Category ?? string.Empty;
        e.CategoryId = string.IsNullOrEmpty(i.CategoryId) ? null : i.CategoryId;
        e.IsEnabled = i.IsEnabled;
        e.SourceBookId = string.IsNullOrEmpty(i.SourceBookId) ? null : i.SourceBookId;
        e.DependencyModuleVersions = i.DependencyModuleVersions ?? new Dictionary<string, int>();
        e.ChapterId = i.ChapterId ?? string.Empty;
        e.OneLineStructure = i.OneLineStructure ?? string.Empty;
        e.PacingCurve = i.PacingCurve ?? string.Empty;
        e.SceneNumber = i.SceneNumber;
        e.SceneTitle = i.SceneTitle ?? string.Empty;
        e.PovCharacter = i.PovCharacter ?? string.Empty;
        e.EstimatedWordCount = i.EstimatedWordCount ?? string.Empty;
        e.Opening = i.Opening ?? string.Empty;
        e.Development = i.Development ?? string.Empty;
        e.Turning = i.Turning ?? string.Empty;
        e.Ending = i.Ending ?? string.Empty;
        e.InfoDrop = i.InfoDrop ?? string.Empty;
        e.Cast = i.Cast ?? string.Empty;
        e.Locations = i.Locations ?? string.Empty;
        e.Factions = i.Factions ?? string.Empty;
        e.ItemsClues = i.ItemsClues ?? string.Empty;
    }

    private static ChapterBlueprintDto Map(ChapterBlueprint e)
        => new(e.Id, e.Name, e.Category, e.CategoryId, e.IsEnabled, e.SourceBookId,
            e.DependencyModuleVersions ?? new(),
            e.ChapterId, e.OneLineStructure, e.PacingCurve,
            e.SceneNumber, e.SceneTitle, e.PovCharacter, e.EstimatedWordCount,
            e.Opening, e.Development, e.Turning, e.Ending, e.InfoDrop,
            e.Cast, e.Locations, e.Factions, e.ItemsClues,
            e.CreatedAt, e.UpdatedAt);
}
