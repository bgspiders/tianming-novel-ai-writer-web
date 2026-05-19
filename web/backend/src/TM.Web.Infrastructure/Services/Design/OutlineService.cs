using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Design;

public class OutlineService : IOutlineService
{
    private readonly AppDbContext _db;
    public OutlineService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<OutlineDto>> ListAsync(DesignListQuery query, CancellationToken ct = default)
    {
        var rows = await _db.Outlines.AsQueryable().ApplyFilter(query).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<OutlineDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.Outlines.FindAsync(new object?[] { id }, ct);
        return e == null ? null : Map(e);
    }

    public async Task<OutlineDto> CreateAsync(OutlineUpsertDto input, CancellationToken ct = default)
    {
        var e = new Outline();
        Apply(e, input);
        _db.Outlines.Add(e);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task<OutlineDto> UpdateAsync(string id, OutlineUpsertDto input, CancellationToken ct = default)
    {
        var e = await _db.Outlines.FindAsync(new object?[] { id }, ct)
                ?? throw new InvalidOperationException("大纲不存在。");
        Apply(e, input);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.Outlines.FindAsync(new object?[] { id }, ct);
        if (e == null) return;
        _db.Outlines.Remove(e);
        await _db.SaveChangesAsync(ct);
    }

    private static void Apply(Outline e, OutlineUpsertDto i)
    {
        if (string.IsNullOrWhiteSpace(i.Name)) throw new InvalidOperationException("名称必填。");
        e.Name = i.Name.Trim();
        e.Category = i.Category ?? string.Empty;
        e.CategoryId = string.IsNullOrEmpty(i.CategoryId) ? null : i.CategoryId;
        e.IsEnabled = i.IsEnabled;
        e.SourceBookId = string.IsNullOrEmpty(i.SourceBookId) ? null : i.SourceBookId;
        e.DependencyModuleVersions = i.DependencyModuleVersions ?? new Dictionary<string, int>();
        e.TotalChapterCount = i.TotalChapterCount;
        e.EstimatedWordCount = i.EstimatedWordCount ?? string.Empty;
        e.OneLineOutline = i.OneLineOutline ?? string.Empty;
        e.EmotionalTone = i.EmotionalTone ?? string.Empty;
        e.PhilosophicalMotif = i.PhilosophicalMotif ?? string.Empty;
        e.Theme = i.Theme ?? string.Empty;
        e.CoreConflict = i.CoreConflict ?? string.Empty;
        e.EndingState = i.EndingState ?? string.Empty;
        e.VolumeDivision = i.VolumeDivision ?? string.Empty;
        e.OutlineOverview = i.OutlineOverview ?? string.Empty;
    }

    private static OutlineDto Map(Outline e)
        => new(e.Id, e.Name, e.Category, e.CategoryId, e.IsEnabled, e.SourceBookId,
            e.DependencyModuleVersions ?? new(),
            e.TotalChapterCount, e.EstimatedWordCount, e.OneLineOutline, e.EmotionalTone,
            e.PhilosophicalMotif, e.Theme, e.CoreConflict, e.EndingState,
            e.VolumeDivision, e.OutlineOverview,
            e.CreatedAt, e.UpdatedAt);
}
