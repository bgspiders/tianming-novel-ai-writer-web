using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Tracking;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Tracking;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Tracking;

public sealed class NarrativeTrackingService : INarrativeTrackingService
{
    private readonly AppDbContext _db;

    public NarrativeTrackingService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<ForeshadowingDto>> ListForeshadowingsAsync(TrackingListQuery query, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query.ProjectId)) throw new InvalidOperationException("项目 ID 不能为空。");
        var rows = _db.Foreshadowings.AsNoTracking().Where(x => x.ProjectId == query.ProjectId);
        if (!string.IsNullOrWhiteSpace(query.SourceBookId))
        {
            rows = rows.Where(x => x.SourceBookId == query.SourceBookId);
        }

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var keyword = query.Keyword.Trim();
            rows = rows.Where(x => x.Name.Contains(keyword)
                                   || x.ExpectedSetupChapter.Contains(keyword)
                                   || x.ExpectedPayoffChapter.Contains(keyword)
                                   || x.ActualSetupChapter.Contains(keyword)
                                   || x.ActualPayoffChapter.Contains(keyword));
        }

        return await rows
            .OrderBy(x => x.IsResolved)
            .ThenBy(x => x.IsOverdue ? 0 : 1)
            .ThenBy(x => x.Tier)
            .ThenBy(x => x.ExpectedPayoffChapter)
            .Select(x => ToDto(x))
            .ToListAsync(ct);
    }

    public async Task<ForeshadowingDto> CreateForeshadowingAsync(ForeshadowingUpsertDto input, CancellationToken ct = default)
    {
        ValidateForeshadowing(input);
        await EnsureProjectAsync(input.ProjectId, ct);
        var row = new Foreshadowing();
        Apply(row, input);
        _db.Foreshadowings.Add(row);
        await _db.SaveChangesAsync(ct);
        return ToDto(row);
    }

    public async Task<ForeshadowingDto> UpdateForeshadowingAsync(string id, ForeshadowingUpsertDto input, CancellationToken ct = default)
    {
        ValidateForeshadowing(input);
        var row = await _db.Foreshadowings.FirstOrDefaultAsync(x => x.Id == id, ct)
                  ?? throw new InvalidOperationException("伏笔不存在。");
        Apply(row, input);
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return ToDto(row);
    }

    public async Task DeleteForeshadowingAsync(string id, CancellationToken ct = default)
    {
        var row = await _db.Foreshadowings.FirstOrDefaultAsync(x => x.Id == id, ct)
                  ?? throw new InvalidOperationException("伏笔不存在。");
        _db.Foreshadowings.Remove(row);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<TimelineDto>> ListTimelinesAsync(TrackingListQuery query, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query.ProjectId)) throw new InvalidOperationException("项目 ID 不能为空。");
        var rows = from timeline in _db.ChapterTimelines.AsNoTracking()
                   join chapter in _db.Chapters.AsNoTracking() on timeline.ChapterId equals chapter.Id
                   where timeline.ProjectId == query.ProjectId
                   select new { timeline, chapter };

        if (!string.IsNullOrWhiteSpace(query.SourceBookId))
        {
            rows = rows.Where(x => x.timeline.SourceBookId == query.SourceBookId);
        }

        if (query.StartChapterNumber.HasValue)
        {
            rows = rows.Where(x => x.chapter.ChapterNumber >= query.StartChapterNumber.Value);
        }

        if (query.EndChapterNumber.HasValue)
        {
            rows = rows.Where(x => x.chapter.ChapterNumber <= query.EndChapterNumber.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var keyword = query.Keyword.Trim();
            rows = rows.Where(x => x.chapter.Title.Contains(keyword)
                                   || x.timeline.TimePeriod.Contains(keyword)
                                   || x.timeline.ElapsedTime.Contains(keyword)
                                   || x.timeline.KeyTimeEvent.Contains(keyword));
        }

        return await rows
            .OrderBy(x => x.chapter.ChapterNumber)
            .ThenBy(x => x.timeline.CreatedAt)
            .Select(x => ToDto(x.timeline, x.chapter.ChapterNumber, x.chapter.Title))
            .ToListAsync(ct);
    }

    public async Task<TimelineDto> CreateTimelineAsync(TimelineUpsertDto input, CancellationToken ct = default)
    {
        ValidateTimeline(input);
        var chapter = await EnsureChapterAsync(input.ProjectId, input.ChapterId, ct);
        var row = new ChapterTimeline();
        Apply(row, input);
        _db.ChapterTimelines.Add(row);
        await _db.SaveChangesAsync(ct);
        return ToDto(row, chapter.ChapterNumber, chapter.Title);
    }

    public async Task<TimelineDto> UpdateTimelineAsync(string id, TimelineUpsertDto input, CancellationToken ct = default)
    {
        ValidateTimeline(input);
        var row = await _db.ChapterTimelines.FirstOrDefaultAsync(x => x.Id == id, ct)
                  ?? throw new InvalidOperationException("时间线不存在。");
        var chapter = await EnsureChapterAsync(input.ProjectId, input.ChapterId, ct);
        Apply(row, input);
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return ToDto(row, chapter.ChapterNumber, chapter.Title);
    }

    public async Task DeleteTimelineAsync(string id, CancellationToken ct = default)
    {
        var row = await _db.ChapterTimelines.FirstOrDefaultAsync(x => x.Id == id, ct)
                  ?? throw new InvalidOperationException("时间线不存在。");
        _db.ChapterTimelines.Remove(row);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<LongNovelCompletenessDto> GetCompletenessAsync(string projectId, string? sourceBookId = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(projectId)) throw new InvalidOperationException("项目 ID 不能为空。");
        var project = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == projectId, ct)
                      ?? throw new InvalidOperationException("项目不存在。");
        sourceBookId = string.IsNullOrWhiteSpace(sourceBookId) ? project.CurrentSourceBookId : sourceBookId;

        var chapters = await _db.Chapters.AsNoTracking().CountAsync(x => x.ProjectId == projectId, ct);
        var drafted = await _db.Chapters.AsNoTracking().CountAsync(x => x.ProjectId == projectId && x.WordCount > 0, ct);
        var plans = await FilterBySourceBook(_db.ChapterPlans.AsNoTracking().Where(x => x.IsEnabled), sourceBookId).CountAsync(ct);
        var blueprints = await FilterBySourceBook(_db.ChapterBlueprints.AsNoTracking().Where(x => x.IsEnabled), sourceBookId).CountAsync(ct);
        var worldRules = await FilterBySourceBook(_db.WorldRules.AsNoTracking().Where(x => x.IsEnabled), sourceBookId).CountAsync(ct);
        var characters = await FilterBySourceBook(_db.CharacterRules.AsNoTracking().Where(x => x.IsEnabled), sourceBookId).CountAsync(ct);
        var foreshadowings = await FilterTrackingBySourceBook(_db.Foreshadowings.AsNoTracking().Where(x => x.ProjectId == projectId), sourceBookId).CountAsync(ct);
        var timelines = await FilterTrackingBySourceBook(_db.ChapterTimelines.AsNoTracking().Where(x => x.ProjectId == projectId), sourceBookId).CountAsync(ct);
        var validations = await _db.ValidationSummaries.AsNoTracking().CountAsync(x => x.ProjectId == projectId, ct);
        var manifests = await _db.Manifests.AsNoTracking().CountAsync(x => x.ProjectId == projectId, ct);

        var items = new List<LongNovelCompletenessItemDto>
        {
            Item("project", "项目", chapters > 0 || plans > 0 ? "ready" : "missing", 1, "项目已创建。", "/"),
            Item("world_rules", "世界规则", worldRules > 0 ? "ready" : "missing", worldRules, worldRules > 0 ? "已有世界规则。" : "缺少世界规则。", "/design/world_rules"),
            Item("characters", "角色档案", characters > 0 ? "ready" : "missing", characters, characters > 0 ? "已有角色档案。" : "缺少角色档案。", "/design/character_rules"),
            Item("chapter_plans", "章节计划", plans > 0 ? "ready" : "missing", plans, plans > 0 ? "已有章节计划。" : "缺少章节计划。", "/generate/chapter_plans"),
            Item("scene_blueprints", "场景蓝图", blueprints > 0 ? "ready" : "missing", blueprints, blueprints > 0 ? "已有场景蓝图。" : "缺少场景蓝图。", "/generate/chapter_blueprints"),
            Item("foreshadowings", "伏笔账本", foreshadowings > 0 ? "ready" : "missing", foreshadowings, foreshadowings > 0 ? "已有伏笔账本。" : "缺少伏笔账本。", "/generate/tracking"),
            Item("timeline", "时间线", timelines > 0 ? "ready" : "missing", timelines, timelines > 0 ? "已有时间线。" : "缺少时间线。", "/generate/tracking"),
            Item("drafts", "章节正文", drafted > 0 ? "ready" : "warning", drafted, drafted > 0 ? $"已完成正文 {drafted}/{chapters} 章。" : "尚未生成正文。", "/generate/chapters"),
            Item("validation", "体检", validations > 0 ? "ready" : "warning", validations, validations > 0 ? "已有体检记录。" : "建议运行体检。", "/validate"),
            Item("archive", "存档打包", manifests > 0 ? "ready" : "warning", manifests, manifests > 0 ? "已有上下文打包记录。" : "建议生成存档快照。", "/generate")
        };

        return new LongNovelCompletenessDto
        {
            ProjectId = projectId,
            Items = items,
            ReadyCount = items.Count(x => x.Status == "ready"),
            MissingCount = items.Count(x => x.Status == "missing"),
            FatalCount = items.Count(x => x.Status == "missing"),
            IsReady = items.All(x => x.Status != "missing")
        };
    }

    public async Task<TrackingRebuildResultDto> RebuildTrackingAsync(TrackingRebuildRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.ProjectId)) throw new InvalidOperationException("项目 ID 不能为空。");
        var project = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.ProjectId, ct)
                      ?? throw new InvalidOperationException("项目不存在。");
        var sourceBookId = string.IsNullOrWhiteSpace(request.SourceBookId)
            ? project.CurrentSourceBookId
            : request.SourceBookId.Trim();

        var oldForeshadowings = await FilterTrackingBySourceBook(
                _db.Foreshadowings.Where(x => x.ProjectId == request.ProjectId),
                sourceBookId)
            .ToListAsync(ct);
        var oldTimelines = await FilterTrackingBySourceBook(
                _db.ChapterTimelines.Where(x => x.ProjectId == request.ProjectId),
                sourceBookId)
            .ToListAsync(ct);
        var removedForeshadowingCount = oldForeshadowings.Count;
        var removedTimelineCount = oldTimelines.Count;
        _db.Foreshadowings.RemoveRange(oldForeshadowings);
        _db.ChapterTimelines.RemoveRange(oldTimelines);

        var chapters = await _db.Chapters.AsNoTracking()
            .Where(x => x.ProjectId == request.ProjectId)
            .OrderBy(x => x.ChapterNumber)
            .ToListAsync(ct);
        var chapterIds = chapters.Select(x => x.Id).ToList();
        var blueprints = await FilterBySourceBook(
                _db.ChapterBlueprints.AsNoTracking().Where(x => x.IsEnabled && chapterIds.Contains(x.ChapterId)),
                sourceBookId)
            .OrderBy(x => x.SceneNumber)
            .ToListAsync(ct);
        var blueprintsByChapter = blueprints
            .GroupBy(x => x.ChapterId)
            .ToDictionary(x => x.Key, x => x.OrderBy(b => b.SceneNumber).ThenBy(b => b.CreatedAt).ToList());

        var foreshadowings = BuildForeshadowingsFromBlueprints(request.ProjectId, sourceBookId, chapters, blueprintsByChapter);
        var timelines = BuildTimelinesFromChapters(request.ProjectId, sourceBookId, chapters, blueprintsByChapter);

        _db.Foreshadowings.AddRange(foreshadowings);
        _db.ChapterTimelines.AddRange(timelines);
        await _db.SaveChangesAsync(ct);

        return new TrackingRebuildResultDto
        {
            ProjectId = request.ProjectId,
            SourceBookId = sourceBookId,
            ChapterCount = chapters.Count,
            BlueprintCount = blueprints.Count,
            RemovedForeshadowingCount = removedForeshadowingCount,
            RemovedTimelineCount = removedTimelineCount,
            ForeshadowingCount = foreshadowings.Count,
            TimelineCount = timelines.Count
        };
    }

    private static List<Foreshadowing> BuildForeshadowingsFromBlueprints(
        string projectId,
        string? sourceBookId,
        IReadOnlyList<TM.Web.Domain.Entities.Core.Chapter> chapters,
        IReadOnlyDictionary<string, List<TM.Web.Domain.Entities.Generate.ChapterBlueprint>> blueprintsByChapter)
    {
        var chapterById = chapters.ToDictionary(x => x.Id);
        var states = new Dictionary<string, ForeshadowingBuildState>(StringComparer.OrdinalIgnoreCase);

        foreach (var chapter in chapters)
        {
            if (!blueprintsByChapter.TryGetValue(chapter.Id, out var blueprints)) continue;
            foreach (var blueprint in blueprints)
            {
                var name = ExtractTaggedValue(blueprint.Cast, "伏笔");
                if (string.IsNullOrWhiteSpace(name)) continue;

                if (!states.TryGetValue(name, out var state))
                {
                    state = new ForeshadowingBuildState(name);
                    states[name] = state;
                }

                var role = ExtractTaggedValue(blueprint.Cast, "职责");
                var chapterLabel = $"第{chapter.ChapterNumber}章";
                if (!state.IsSetup || role.Contains("埋设", StringComparison.OrdinalIgnoreCase))
                {
                    state.IsSetup = true;
                    state.ExpectedSetupChapter = FirstNonEmpty(state.ExpectedSetupChapter, chapterLabel);
                    state.ActualSetupChapter = FirstNonEmpty(state.ActualSetupChapter, chapterLabel);
                }

                if (role.Contains("回收", StringComparison.OrdinalIgnoreCase))
                {
                    state.IsResolved = true;
                    state.ExpectedPayoffChapter = FirstNonEmpty(state.ExpectedPayoffChapter, chapterLabel);
                    state.ActualPayoffChapter = FirstNonEmpty(state.ActualPayoffChapter, chapterLabel);
                }

                state.Sources.Add($"{chapterLabel} 场景{blueprint.SceneNumber}《{FirstNonEmpty(blueprint.SceneTitle, blueprint.Name, "未命名")}》:{FirstNonEmpty(role, "推进")}");
            }
        }

        return states.Values
            .Select(x => new Foreshadowing
            {
                ProjectId = projectId,
                SourceBookId = sourceBookId,
                Name = x.Name,
                Tier = "Tier-2",
                IsSetup = x.IsSetup,
                IsResolved = x.IsResolved,
                IsOverdue = false,
                ExpectedSetupChapter = x.ExpectedSetupChapter,
                ExpectedPayoffChapter = x.ExpectedPayoffChapter,
                ActualSetupChapter = x.ActualSetupChapter,
                ActualPayoffChapter = x.ActualPayoffChapter,
                OverdueSuggestion = $"由场景蓝图重建：{string.Join("；", x.Sources.Take(6))}"
            })
            .OrderBy(x => x.ExpectedSetupChapter)
            .ThenBy(x => x.Name)
            .ToList();
    }

    private static List<ChapterTimeline> BuildTimelinesFromChapters(
        string projectId,
        string? sourceBookId,
        IReadOnlyList<TM.Web.Domain.Entities.Core.Chapter> chapters,
        IReadOnlyDictionary<string, List<TM.Web.Domain.Entities.Generate.ChapterBlueprint>> blueprintsByChapter)
    {
        var rows = new List<ChapterTimeline>();
        foreach (var chapter in chapters)
        {
            blueprintsByChapter.TryGetValue(chapter.Id, out var blueprints);
            var firstBlueprint = blueprints?.FirstOrDefault();
            var timelineBlueprint = blueprints?.FirstOrDefault(x => !string.IsNullOrWhiteSpace(ExtractTaggedValue(x.InfoDrop, "时间线")))
                                  ?? firstBlueprint;
            var keyEvent = FirstNonEmpty(
                ExtractTaggedValue(timelineBlueprint?.InfoDrop, "时间线"),
                timelineBlueprint?.OneLineStructure,
                chapter.Summary,
                chapter.Title);
            if (string.IsNullOrWhiteSpace(keyEvent)) continue;

            rows.Add(new ChapterTimeline
            {
                ProjectId = projectId,
                SourceBookId = sourceBookId,
                ChapterId = chapter.Id,
                TimePeriod = FirstNonEmpty(ExtractTaggedValue(firstBlueprint?.InfoDrop, "时间"), $"第{chapter.ChapterNumber}章"),
                ElapsedTime = ExtractTaggedValue(firstBlueprint?.InfoDrop, "经过"),
                KeyTimeEvent = keyEvent,
                Importance = chapter.ChapterNumber <= 3 ? "high" : "normal"
            });
        }

        return rows;
    }

    private async Task EnsureProjectAsync(string projectId, CancellationToken ct)
    {
        if (!await _db.Projects.AnyAsync(x => x.Id == projectId, ct))
        {
            throw new InvalidOperationException("项目不存在。");
        }
    }

    private async Task<TM.Web.Domain.Entities.Core.Chapter> EnsureChapterAsync(string projectId, string chapterId, CancellationToken ct)
        => await _db.Chapters.AsNoTracking().FirstOrDefaultAsync(x => x.Id == chapterId && x.ProjectId == projectId, ct)
           ?? throw new InvalidOperationException("章节不存在或不属于当前项目。");

    private static void ValidateForeshadowing(ForeshadowingUpsertDto input)
    {
        if (string.IsNullOrWhiteSpace(input.ProjectId)) throw new InvalidOperationException("项目 ID 不能为空。");
        if (string.IsNullOrWhiteSpace(input.Name)) throw new InvalidOperationException("伏笔名称不能为空。");
        input.Tier = NormalizeTier(input.Tier);
    }

    private static void ValidateTimeline(TimelineUpsertDto input)
    {
        if (string.IsNullOrWhiteSpace(input.ProjectId)) throw new InvalidOperationException("项目 ID 不能为空。");
        if (string.IsNullOrWhiteSpace(input.ChapterId)) throw new InvalidOperationException("章节 ID 不能为空。");
        if (string.IsNullOrWhiteSpace(input.KeyTimeEvent)) throw new InvalidOperationException("关键时间事件不能为空。");
    }

    private static void Apply(Foreshadowing row, ForeshadowingUpsertDto input)
    {
        row.ProjectId = input.ProjectId;
        row.SourceBookId = string.IsNullOrWhiteSpace(input.SourceBookId) ? null : input.SourceBookId.Trim();
        row.Name = input.Name.Trim();
        row.Tier = NormalizeTier(input.Tier);
        row.IsSetup = input.IsSetup;
        row.IsResolved = input.IsResolved;
        row.IsOverdue = input.IsOverdue;
        row.ExpectedSetupChapter = input.ExpectedSetupChapter?.Trim() ?? string.Empty;
        row.ExpectedPayoffChapter = input.ExpectedPayoffChapter?.Trim() ?? string.Empty;
        row.ActualSetupChapter = input.ActualSetupChapter?.Trim() ?? string.Empty;
        row.ActualPayoffChapter = input.ActualPayoffChapter?.Trim() ?? string.Empty;
        row.OverdueSuggestion = input.OverdueSuggestion?.Trim() ?? string.Empty;
    }

    private static void Apply(ChapterTimeline row, TimelineUpsertDto input)
    {
        row.ProjectId = input.ProjectId;
        row.ChapterId = input.ChapterId;
        row.SourceBookId = string.IsNullOrWhiteSpace(input.SourceBookId) ? null : input.SourceBookId.Trim();
        row.TimePeriod = input.TimePeriod?.Trim() ?? string.Empty;
        row.ElapsedTime = input.ElapsedTime?.Trim() ?? string.Empty;
        row.KeyTimeEvent = input.KeyTimeEvent.Trim();
        row.Importance = string.IsNullOrWhiteSpace(input.Importance) ? "normal" : input.Importance.Trim();
    }

    private static ForeshadowingDto ToDto(Foreshadowing row)
        => new()
        {
            Id = row.Id,
            ProjectId = row.ProjectId,
            SourceBookId = row.SourceBookId,
            Name = row.Name,
            Tier = row.Tier,
            IsSetup = row.IsSetup,
            IsResolved = row.IsResolved,
            IsOverdue = row.IsOverdue,
            ExpectedSetupChapter = row.ExpectedSetupChapter,
            ExpectedPayoffChapter = row.ExpectedPayoffChapter,
            ActualSetupChapter = row.ActualSetupChapter,
            ActualPayoffChapter = row.ActualPayoffChapter,
            OverdueSuggestion = row.OverdueSuggestion,
            CreatedAt = row.CreatedAt,
            UpdatedAt = row.UpdatedAt
        };

    private static TimelineDto ToDto(ChapterTimeline row, int chapterNumber, string chapterTitle)
        => new()
        {
            Id = row.Id,
            ProjectId = row.ProjectId,
            ChapterId = row.ChapterId,
            SourceBookId = row.SourceBookId,
            ChapterNumber = chapterNumber,
            ChapterTitle = chapterTitle,
            TimePeriod = row.TimePeriod,
            ElapsedTime = row.ElapsedTime,
            KeyTimeEvent = row.KeyTimeEvent,
            Importance = row.Importance,
            CreatedAt = row.CreatedAt,
            UpdatedAt = row.UpdatedAt
        };

    private static LongNovelCompletenessItemDto Item(string key, string label, string status, int count, string message, string route)
        => new()
        {
            Key = key,
            Label = label,
            Status = status,
            Count = count,
            Message = message,
            Route = route
        };

    private static string NormalizeTier(string? tier)
        => tier?.Trim() switch
        {
            "Tier-1" => "Tier-1",
            "Tier-2" => "Tier-2",
            _ => "Tier-3"
        };

    private static string ExtractTaggedValue(string? value, string tag)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var parts = value.Split('；', ';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var prefix = $"{tag}：";
        return parts.FirstOrDefault(x => x.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))?[prefix.Length..].Trim() ?? string.Empty;
    }

    private static string FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim() ?? string.Empty;

    private static IQueryable<T> FilterBySourceBook<T>(IQueryable<T> query, string? sourceBookId) where T : class
        => string.IsNullOrWhiteSpace(sourceBookId)
            ? query
            : query.Where(x => EF.Property<string?>(x, "SourceBookId") == sourceBookId);

    private static IQueryable<T> FilterTrackingBySourceBook<T>(IQueryable<T> query, string? sourceBookId) where T : class
        => string.IsNullOrWhiteSpace(sourceBookId)
            ? query
            : query.Where(x => EF.Property<string?>(x, "SourceBookId") == sourceBookId);

    private sealed class ForeshadowingBuildState
    {
        public ForeshadowingBuildState(string name)
        {
            Name = name;
        }

        public string Name { get; }
        public bool IsSetup { get; set; }
        public bool IsResolved { get; set; }
        public string ExpectedSetupChapter { get; set; } = string.Empty;
        public string ExpectedPayoffChapter { get; set; } = string.Empty;
        public string ActualSetupChapter { get; set; } = string.Empty;
        public string ActualPayoffChapter { get; set; } = string.Empty;
        public List<string> Sources { get; } = new();
    }
}
