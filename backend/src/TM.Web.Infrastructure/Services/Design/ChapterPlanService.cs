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
        query = await _db.ResolveProjectScopeAsync(query, ct);
        var rows = await ApplyDefaultOrder(_db.ChapterPlans.AsQueryable().ApplyFilter(query)).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<PagedResult<ChapterPlanDto>> ListPagedAsync(DesignListQuery query, CancellationToken ct = default)
    {
        query = await _db.ResolveProjectScopeAsync(query, ct);
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var filtered = _db.ChapterPlans.AsQueryable().ApplyFilter(query);
        var total = await filtered.CountAsync(ct);
        var rows = await ApplyDefaultOrder(filtered).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return new PagedResult<ChapterPlanDto>(rows.Select(Map).ToList(), total, page, pageSize);
    }

    public async Task<ChapterPlanDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.ChapterPlans.FindAsync(new object?[] { id }, ct);
        return e == null ? null : Map(e);
    }

    public async Task<ChapterPlanDto> CreateAsync(ChapterPlanUpsertDto input, CancellationToken ct = default)
    {
        var sourceBookId = await _db.ResolveWriteSourceBookIdAsync(input.ProjectId, input.SourceBookId, ct);
        var e = new ChapterPlan();
        Apply(e, input, sourceBookId);
        _db.ChapterPlans.Add(e);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task<ChapterPlanDto> UpdateAsync(string id, ChapterPlanUpsertDto input, CancellationToken ct = default)
    {
        var e = await _db.ChapterPlans.FindAsync(new object?[] { id }, ct)
                ?? throw new InvalidOperationException("章节规划不存在。");
        var sourceBookId = await _db.ResolveWriteSourceBookIdAsync(input.ProjectId, input.SourceBookId, ct);
        Apply(e, input, sourceBookId);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task<ChapterPlanSummaryRewriteResultDto> RewriteSummariesAsync(DesignListQuery query, CancellationToken ct = default)
    {
        query = await _db.ResolveProjectScopeAsync(query, ct);
        var rows = await ApplyDefaultOrder(_db.ChapterPlans.AsQueryable().ApplyFilter(query)).ToListAsync(ct);
        var seenTitles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var seenSummaries = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var plan in rows)
        {
            plan.ChapterTitle = DeduplicateTitle(plan, seenTitles);
            var summary = BuildSummary(plan);
            summary = DeduplicateSummary(plan, summary, seenSummaries);
            plan.ChapterTheme = summary;
            plan.MainGoal = BuildCoreEvent(plan);
            plan.CoreEvent = plan.MainGoal;
            plan.MainPlotProgress = summary;
            plan.UpdatedAt = DateTime.UtcNow;
        }

        if (rows.Count > 0)
        {
            await _db.SaveChangesAsync(ct);
        }

        return new ChapterPlanSummaryRewriteResultDto(rows.Count, rows.Count, rows.Select(Map).ToList());
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.ChapterPlans.FindAsync(new object?[] { id }, ct);
        if (e == null) return;
        _db.ChapterPlans.Remove(e);
        await _db.SaveChangesAsync(ct);
    }

    private static void Apply(ChapterPlan e, ChapterPlanUpsertDto i, string? sourceBookId)
    {
        if (string.IsNullOrWhiteSpace(i.Name)) throw new InvalidOperationException("名称必填。");
        e.Name = i.Name.Trim();
        e.Category = i.Category ?? string.Empty;
        e.CategoryId = string.IsNullOrEmpty(i.CategoryId) ? null : i.CategoryId;
        e.IsEnabled = i.IsEnabled;
        e.SourceBookId = sourceBookId;
        e.DependencyModuleVersions = i.DependencyModuleVersions ?? new Dictionary<string, int>();
        e.ChapterTitle = i.ChapterTitle ?? string.Empty;
        e.ChapterNumber = i.ChapterNumber;
        e.Volume = i.Volume ?? string.Empty;
        e.EstimatedWordCount = i.EstimatedWordCount ?? string.Empty;
        e.ChapterTheme = i.ChapterTheme ?? string.Empty;
        e.ReaderExperienceGoal = i.ReaderExperienceGoal ?? string.Empty;
        e.MainGoal = i.MainGoal ?? string.Empty;
        e.MacroPhase = i.MacroPhase ?? string.Empty;
        e.TacticalArcId = i.TacticalArcId ?? string.Empty;
        e.TacticalArcTitle = i.TacticalArcTitle ?? string.Empty;
        e.ChapterType = i.ChapterType ?? string.Empty;
        e.ConflictScore = i.ConflictScore ?? string.Empty;
        e.CoreEvent = i.CoreEvent ?? string.Empty;
        e.AllowedEntities = i.AllowedEntities ?? new List<string>();
        e.ResistanceSource = i.ResistanceSource ?? string.Empty;
        e.KeyTurn = i.KeyTurn ?? string.Empty;
        e.Hook = i.Hook ?? string.Empty;
        e.StatusMarkers = i.StatusMarkers ?? string.Empty;
        e.TemporalAnchor = i.TemporalAnchor ?? string.Empty;
        e.SpatialAnchor = i.SpatialAnchor ?? string.Empty;
        e.TimelineCoordinate = i.TimelineCoordinate ?? string.Empty;
        e.IsSingularityEvent = i.IsSingularityEvent;
        e.BufferRole = i.BufferRole ?? string.Empty;
        e.ForeshadowingTier = i.ForeshadowingTier ?? string.Empty;
        e.ForeshadowingRole = i.ForeshadowingRole ?? string.Empty;
        e.WorldInfoDrop = i.WorldInfoDrop ?? string.Empty;
        e.CharacterArcProgress = i.CharacterArcProgress ?? string.Empty;
        e.MainPlotProgress = i.MainPlotProgress ?? string.Empty;
        e.Foreshadowing = i.Foreshadowing ?? string.Empty;
        e.ReferencedCharacterNames = i.ReferencedCharacterNames ?? new List<string>();
        e.ReferencedFactionNames = i.ReferencedFactionNames ?? new List<string>();
        e.ReferencedLocationNames = i.ReferencedLocationNames ?? new List<string>();
    }

    private static IOrderedQueryable<ChapterPlan> ApplyDefaultOrder(IQueryable<ChapterPlan> query)
        => query.OrderBy(x => x.ChapterNumber)
            .ThenBy(x => x.ChapterTitle)
            .ThenBy(x => x.Name);

    private static string BuildSummary(ChapterPlan plan)
    {
        var coreEvent = BuildCoreEvent(plan);
        var theme = FirstNonEmpty(plan.ChapterType, plan.MacroPhase, ExtractTheme(plan.ChapterTheme), "主线推进");
        var resistance = TrimSentenceEnd(FirstNonEmpty(plan.ResistanceSource, "外部阻力持续升级"));
        var keyTurn = TrimSentenceEnd(FirstNonEmpty(plan.KeyTurn, "当前计划被迫调整"));
        var hook = TrimSentenceEnd(FirstNonEmpty(plan.Hook, "新的危机在章末出现"));
        var volume = FirstNonEmpty(plan.Volume, "当前卷");
        var chapterNumber = plan.ChapterNumber > 0 ? $"第 {plan.ChapterNumber} 章" : "本章";
        return $"{volume}{chapterNumber}，{coreEvent}。主题落在“{theme}”；阻力来自{resistance}。转折：{keyTurn}；章末钩子：{hook}";
    }

    private static string DeduplicateTitle(ChapterPlan plan, HashSet<string> seenTitles)
    {
        var title = FirstNonEmpty(plan.ChapterTitle, plan.Name, $"第{plan.ChapterNumber}章");
        if (seenTitles.Add(NormalizeKey(title))) return title;

        var suffix = plan.ChapterNumber > 0 ? $"第{plan.ChapterNumber}章" : $"重写{seenTitles.Count + 1}";
        var candidate = $"{title}（{suffix}）";
        var attempt = 2;
        while (!seenTitles.Add(NormalizeKey(candidate)))
        {
            candidate = $"{title}（{suffix}-{attempt++}）";
        }

        return candidate;
    }

    private static string DeduplicateSummary(ChapterPlan plan, string summary, HashSet<string> seenSummaries)
    {
        if (seenSummaries.Add(NormalizeKey(summary))) return summary;

        var marker = FirstNonEmpty(plan.ChapterTitle, $"第{plan.ChapterNumber}章");
        var candidate = $"{summary} 本章差异点：以“{marker}”的独立推进和实体组合校准节奏。";
        var attempt = 2;
        while (!seenSummaries.Add(NormalizeKey(candidate)))
        {
            candidate = $"{summary} 本章差异点：以“{marker}”的第 {attempt++} 组独立推进校准节奏。";
        }

        return candidate;
    }

    private static string BuildCoreEvent(ChapterPlan plan)
    {
        var actor = PickByChapter(plan.ReferencedCharacterNames, plan.ChapterNumber, "主角");
        var location = PickByChapter(plan.ReferencedLocationNames, plan.ChapterNumber, string.Empty);
        var faction = PickByChapter(plan.ReferencedFactionNames, plan.ChapterNumber, string.Empty);
        var action = GetChapterAction(plan.ChapterNumber);
        var goal = FirstNonEmpty(plan.CoreEvent, plan.MainGoal, plan.ReaderExperienceGoal, "推进当前阶段目标");
        var place = string.IsNullOrWhiteSpace(location) ? string.Empty : $"在{location}";
        var opponent = string.IsNullOrWhiteSpace(faction) ? string.Empty : $"，同时牵出{faction}的反应";
        var focus = BuildChapterFocus(plan.ChapterNumber);
        return $"{actor}{place}{action}，以{focus}作为切口，推进“{TrimSentenceEnd(goal)}”{opponent}";
    }

    private static string PickByChapter(IReadOnlyList<string>? values, int chapterNumber, string fallback)
    {
        var list = values?.Where(x => !string.IsNullOrWhiteSpace(x)).ToList() ?? new List<string>();
        return list.Count == 0 ? fallback : list[Math.Max(0, chapterNumber - 1) % list.Count];
    }

    private static string GetChapterAction(int chapterNumber)
    {
        var actions = new[]
        {
            "锁定第一处异常痕迹",
            "追问目击者并交换情报",
            "潜入边缘区域确认线索",
            "与对立方完成第一次试探",
            "拆解误导信息并校准目标",
            "临时结盟推进调查",
            "正面突破一处封锁",
            "付出代价换取关键证据",
            "揭开隐藏关系链",
            "逼迫幕后势力提前出手",
            "整合资源准备决断",
            "用阶段成果引出下一轮危机"
        };
        return actions[Math.Max(0, chapterNumber - 1) % actions.Length];
    }

    private static string BuildChapterFocus(int chapterNumber)
    {
        var evidenceKinds = new[] { "异常符痕", "目击证词", "尸气残留", "账册缺口", "阵法回响" };
        var pressureKinds = new[] { "封锁压力", "舆论误导", "资源断供", "身份暴露", "时间倒逼", "同伴分歧", "敌方试探" };
        var choiceKinds = new[] { "试探", "交换", "潜入", "反制" };
        var index = Math.Max(0, chapterNumber - 1);
        return $"{evidenceKinds[index % evidenceKinds.Length]}、{pressureKinds[index % pressureKinds.Length]}与{choiceKinds[index % choiceKinds.Length]}";
    }

    private static string ExtractTheme(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var start = value.IndexOf('“');
        var end = value.IndexOf('”', start + 1);
        return start >= 0 && end > start ? value[(start + 1)..end] : string.Empty;
    }

    private static string FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim() ?? string.Empty;

    private static string TrimSentenceEnd(string value)
        => value.Trim().TrimEnd('。', '；', ';', '.', '，', ',');

    private static string NormalizeKey(string value)
        => new(value.Where(c => !char.IsWhiteSpace(c) && c is not '，' and not ',' and not '。' and not '；' and not ';').ToArray());

    private static ChapterPlanDto Map(ChapterPlan e)
        => new(e.Id, e.Name, e.Category, e.CategoryId, e.IsEnabled, e.SourceBookId,
            e.DependencyModuleVersions ?? new(),
            e.ChapterTitle, e.ChapterNumber, e.Volume, e.EstimatedWordCount, e.ChapterTheme,
            e.ReaderExperienceGoal, e.MainGoal,
            e.MacroPhase, e.TacticalArcId, e.TacticalArcTitle, e.ChapterType, e.ConflictScore, e.CoreEvent,
            e.AllowedEntities ?? new(),
            e.ResistanceSource, e.KeyTurn, e.Hook,
            e.StatusMarkers, e.TemporalAnchor, e.SpatialAnchor, e.TimelineCoordinate, e.IsSingularityEvent, e.BufferRole,
            e.ForeshadowingTier, e.ForeshadowingRole,
            e.WorldInfoDrop, e.CharacterArcProgress, e.MainPlotProgress, e.Foreshadowing,
            e.ReferencedCharacterNames ?? new(), e.ReferencedFactionNames ?? new(), e.ReferencedLocationNames ?? new(),
            e.CreatedAt, e.UpdatedAt);
}
