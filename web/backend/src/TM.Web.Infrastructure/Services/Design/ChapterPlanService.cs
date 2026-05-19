using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Design;

public class ChapterPlanService : IChapterPlanService
{
    private readonly AppDbContext _db;
    public ChapterPlanService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<ChapterPlanDto>> ListAsync(DesignListQuery query, CancellationToken ct = default)
    {
        var rows = await _db.ChapterPlans.AsQueryable().ApplyFilter(query).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<ChapterPlanDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.ChapterPlans.FindAsync(new object?[] { id }, ct);
        return e == null ? null : Map(e);
    }

    public async Task<ChapterPlanDto> CreateAsync(ChapterPlanUpsertDto input, CancellationToken ct = default)
    {
        var e = new ChapterPlan();
        Apply(e, input);
        _db.ChapterPlans.Add(e);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task<ChapterPlanDto> UpdateAsync(string id, ChapterPlanUpsertDto input, CancellationToken ct = default)
    {
        var e = await _db.ChapterPlans.FindAsync(new object?[] { id }, ct)
                ?? throw new InvalidOperationException("章节规划不存在。");
        Apply(e, input);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.ChapterPlans.FindAsync(new object?[] { id }, ct);
        if (e == null) return;
        _db.ChapterPlans.Remove(e);
        await _db.SaveChangesAsync(ct);
    }

    private static void Apply(ChapterPlan e, ChapterPlanUpsertDto i)
    {
        if (string.IsNullOrWhiteSpace(i.Name)) throw new InvalidOperationException("名称必填。");
        e.Name = i.Name.Trim();
        e.Category = i.Category ?? string.Empty;
        e.CategoryId = string.IsNullOrEmpty(i.CategoryId) ? null : i.CategoryId;
        e.IsEnabled = i.IsEnabled;
        e.SourceBookId = string.IsNullOrEmpty(i.SourceBookId) ? null : i.SourceBookId;
        e.DependencyModuleVersions = i.DependencyModuleVersions ?? new Dictionary<string, int>();
        e.ChapterTitle = i.ChapterTitle ?? string.Empty;
        e.ChapterNumber = i.ChapterNumber;
        e.Volume = i.Volume ?? string.Empty;
        e.EstimatedWordCount = i.EstimatedWordCount ?? string.Empty;
        e.ChapterTheme = i.ChapterTheme ?? string.Empty;
        e.ReaderExperienceGoal = i.ReaderExperienceGoal ?? string.Empty;
        e.MainGoal = i.MainGoal ?? string.Empty;
        e.ResistanceSource = i.ResistanceSource ?? string.Empty;
        e.KeyTurn = i.KeyTurn ?? string.Empty;
        e.Hook = i.Hook ?? string.Empty;
        e.WorldInfoDrop = i.WorldInfoDrop ?? string.Empty;
        e.CharacterArcProgress = i.CharacterArcProgress ?? string.Empty;
        e.MainPlotProgress = i.MainPlotProgress ?? string.Empty;
        e.Foreshadowing = i.Foreshadowing ?? string.Empty;
        e.ReferencedCharacterNames = i.ReferencedCharacterNames ?? new List<string>();
        e.ReferencedFactionNames = i.ReferencedFactionNames ?? new List<string>();
        e.ReferencedLocationNames = i.ReferencedLocationNames ?? new List<string>();
    }

    private static ChapterPlanDto Map(ChapterPlan e)
        => new(e.Id, e.Name, e.Category, e.CategoryId, e.IsEnabled, e.SourceBookId,
            e.DependencyModuleVersions ?? new(),
            e.ChapterTitle, e.ChapterNumber, e.Volume, e.EstimatedWordCount, e.ChapterTheme,
            e.ReaderExperienceGoal, e.MainGoal,
            e.ResistanceSource, e.KeyTurn, e.Hook,
            e.WorldInfoDrop, e.CharacterArcProgress, e.MainPlotProgress, e.Foreshadowing,
            e.ReferencedCharacterNames ?? new(), e.ReferencedFactionNames ?? new(), e.ReferencedLocationNames ?? new(),
            e.CreatedAt, e.UpdatedAt);
}
