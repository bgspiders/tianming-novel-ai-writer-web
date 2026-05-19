using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Design;

public class VolumeDesignService : IVolumeDesignService
{
    private readonly AppDbContext _db;
    public VolumeDesignService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<VolumeDesignDto>> ListAsync(DesignListQuery query, CancellationToken ct = default)
    {
        var rows = await _db.VolumeDesigns.AsQueryable().ApplyFilter(query).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<VolumeDesignDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.VolumeDesigns.FindAsync(new object?[] { id }, ct);
        return e == null ? null : Map(e);
    }

    public async Task<VolumeDesignDto> CreateAsync(VolumeDesignUpsertDto input, CancellationToken ct = default)
    {
        var e = new VolumeDesign();
        Apply(e, input);
        _db.VolumeDesigns.Add(e);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task<VolumeDesignDto> UpdateAsync(string id, VolumeDesignUpsertDto input, CancellationToken ct = default)
    {
        var e = await _db.VolumeDesigns.FindAsync(new object?[] { id }, ct)
                ?? throw new InvalidOperationException("卷设计不存在。");
        Apply(e, input);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.VolumeDesigns.FindAsync(new object?[] { id }, ct);
        if (e == null) return;
        _db.VolumeDesigns.Remove(e);
        await _db.SaveChangesAsync(ct);
    }

    private static void Apply(VolumeDesign e, VolumeDesignUpsertDto i)
    {
        if (string.IsNullOrWhiteSpace(i.Name)) throw new InvalidOperationException("名称必填。");
        e.Name = i.Name.Trim();
        e.Category = i.Category ?? string.Empty;
        e.CategoryId = string.IsNullOrEmpty(i.CategoryId) ? null : i.CategoryId;
        e.IsEnabled = i.IsEnabled;
        e.SourceBookId = string.IsNullOrEmpty(i.SourceBookId) ? null : i.SourceBookId;
        e.DependencyModuleVersions = i.DependencyModuleVersions ?? new Dictionary<string, int>();
        e.VolumeNumber = i.VolumeNumber;
        e.VolumeTitle = i.VolumeTitle ?? string.Empty;
        e.VolumeTheme = i.VolumeTheme ?? string.Empty;
        e.StageGoal = i.StageGoal ?? string.Empty;
        e.EstimatedWordCount = i.EstimatedWordCount ?? string.Empty;
        e.TargetChapterCount = i.TargetChapterCount;
        e.StartChapter = i.StartChapter;
        e.EndChapter = i.EndChapter;
        e.MainConflict = i.MainConflict ?? string.Empty;
        e.PressureSource = i.PressureSource ?? string.Empty;
        e.KeyEvents = i.KeyEvents ?? string.Empty;
        e.OpeningState = i.OpeningState ?? string.Empty;
        e.EndingState = i.EndingState ?? string.Empty;
        e.ChapterAllocationOverview = i.ChapterAllocationOverview ?? string.Empty;
        e.PlotAllocation = i.PlotAllocation ?? string.Empty;
        e.ChapterGenerationHints = i.ChapterGenerationHints ?? string.Empty;
        e.ReferencedCharacterNames = i.ReferencedCharacterNames ?? new List<string>();
        e.ReferencedFactionNames = i.ReferencedFactionNames ?? new List<string>();
        e.ReferencedLocationNames = i.ReferencedLocationNames ?? new List<string>();
    }

    private static VolumeDesignDto Map(VolumeDesign e)
        => new(e.Id, e.Name, e.Category, e.CategoryId, e.IsEnabled, e.SourceBookId,
            e.DependencyModuleVersions ?? new(),
            e.VolumeNumber, e.VolumeTitle, e.VolumeTheme, e.StageGoal, e.EstimatedWordCount,
            e.TargetChapterCount, e.StartChapter, e.EndChapter,
            e.MainConflict, e.PressureSource, e.KeyEvents, e.OpeningState, e.EndingState,
            e.ChapterAllocationOverview, e.PlotAllocation, e.ChapterGenerationHints,
            e.ReferencedCharacterNames ?? new(), e.ReferencedFactionNames ?? new(), e.ReferencedLocationNames ?? new(),
            e.CreatedAt, e.UpdatedAt);
}
