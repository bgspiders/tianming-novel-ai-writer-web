using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Design;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Design;

public class PlotRuleService : IPlotRuleService
{
    private readonly AppDbContext _db;
    public PlotRuleService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<PlotRuleDto>> ListAsync(DesignListQuery query, CancellationToken ct = default)
    {
        var rows = await _db.PlotRules.AsQueryable().ApplyFilter(query).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<PlotRuleDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.PlotRules.FindAsync(new object?[] { id }, ct);
        return e == null ? null : Map(e);
    }

    public async Task<PlotRuleDto> CreateAsync(PlotRuleUpsertDto input, CancellationToken ct = default)
    {
        var e = new PlotRule();
        Apply(e, input);
        _db.PlotRules.Add(e);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task<PlotRuleDto> UpdateAsync(string id, PlotRuleUpsertDto input, CancellationToken ct = default)
    {
        var e = await _db.PlotRules.FindAsync(new object?[] { id }, ct)
                ?? throw new InvalidOperationException("剧情规则不存在。");
        Apply(e, input);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.PlotRules.FindAsync(new object?[] { id }, ct);
        if (e == null) return;
        _db.PlotRules.Remove(e);
        await _db.SaveChangesAsync(ct);
    }

    private static void Apply(PlotRule e, PlotRuleUpsertDto i)
    {
        if (string.IsNullOrWhiteSpace(i.Name)) throw new InvalidOperationException("名称必填。");
        e.Name = i.Name.Trim();
        e.Category = i.Category ?? "";
        e.CategoryId = string.IsNullOrEmpty(i.CategoryId) ? null : i.CategoryId;
        e.IsEnabled = i.IsEnabled;
        e.SourceBookId = string.IsNullOrEmpty(i.SourceBookId) ? null : i.SourceBookId;
        e.TargetVolume = i.TargetVolume ?? "";
        e.AssignedVolume = i.AssignedVolume ?? "";
        e.OneLineSummary = i.OneLineSummary ?? "";
        e.EventType = i.EventType ?? "";
        e.StoryPhase = i.StoryPhase ?? "";
        e.PrerequisitesTrigger = i.PrerequisitesTrigger ?? "";
        e.MainCharacters = i.MainCharacters ?? "";
        e.KeyNpcs = i.KeyNpcs ?? "";
        e.Location = i.Location ?? "";
        e.TimeDuration = i.TimeDuration ?? "";
        e.StepTitle = i.StepTitle ?? "";
        e.Goal = i.Goal ?? "";
        e.Conflict = i.Conflict ?? "";
        e.Result = i.Result ?? "";
        e.EmotionCurve = i.EmotionCurve ?? "";
        e.MainPlotPush = i.MainPlotPush ?? "";
        e.CharacterGrowth = i.CharacterGrowth ?? "";
        e.WorldReveal = i.WorldReveal ?? "";
        e.RewardsClues = i.RewardsClues ?? "";
    }

    private static PlotRuleDto Map(PlotRule e)
        => new(e.Id, e.Name, e.Category, e.CategoryId, e.IsEnabled, e.SourceBookId,
            e.TargetVolume, e.AssignedVolume, e.OneLineSummary, e.EventType, e.StoryPhase, e.PrerequisitesTrigger,
            e.MainCharacters, e.KeyNpcs, e.Location, e.TimeDuration,
            e.StepTitle, e.Goal, e.Conflict, e.Result, e.EmotionCurve,
            e.MainPlotPush, e.CharacterGrowth, e.WorldReveal, e.RewardsClues,
            e.CreatedAt, e.UpdatedAt);
}
