using System.Text.Json;
using System.Runtime.CompilerServices;
using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Core;
using TM.Web.Domain.Entities.Design;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Domain.Entities.Runtime;
using TM.Web.Infrastructure.Persistence;

[assembly: InternalsVisibleTo("TM.Web.Tests")]

namespace TM.Web.Infrastructure.Services.Generation;

public sealed class NovelSeedService : INovelSeedService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    private readonly AppDbContext _db;
    private readonly IAiCompletionService _ai;
    private readonly IAiApiKeyService _apiKeys;

    public NovelSeedService(AppDbContext db, IAiCompletionService ai, IAiApiKeyService apiKeys)
    {
        _db = db;
        _ai = ai;
        _apiKeys = apiKeys;
    }

    public async Task<NovelSeedResult> GenerateAsync(NovelSeedRequest request, CancellationToken ct = default)
    {
        Validate(request);

        var apiKey = await ResolveApiKeyAsync(request, ct);
        var plan = await GeneratePlanAsync(request, apiKey, ct);

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var project = new Project
        {
            Name = UniqueProjectName(FirstNonEmpty(plan.ProjectTitle, GuessProjectName(request.Description))),
            Description = FirstNonEmpty(plan.Logline, request.Description),
            LastModifiedAt = DateTime.UtcNow
        };
        _db.Projects.Add(project);
        await _db.SaveChangesAsync(ct);

        var sourceBook = new SourceBook
        {
            Name = $"{project.Name} - AI 开书设定",
            Author = "AI",
            Genre = FirstNonEmpty(plan.Genre, request.Genre),
            ChapterCount = request.VolumeCount * request.ChaptersPerVolume,
            TotalWordCount = request.VolumeCount * request.ChaptersPerVolume * request.EstimatedWordsPerChapter,
            CrawledAt = DateTime.UtcNow
        };
        _db.SourceBooks.Add(sourceBook);
        project.CurrentSourceBookId = sourceBook.Id;
        await _db.SaveChangesAsync(ct);

        var volumes = CreateVolumes(project.Id, request, plan).ToList();
        _db.Volumes.AddRange(volumes);

        var chapters = request.CreateChapters
            ? CreateChapters(project.Id, volumes, request, plan).ToList()
            : new List<Chapter>();
        _db.Chapters.AddRange(chapters);

        var designCounts = request.CreateDesignData
            ? CreateDesignData(sourceBook.Id, request, plan, volumes, chapters)
            : new DesignCounts();

        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new NovelSeedResult(
            ToProjectDto(project),
            volumes.Select(ToVolumeDto).ToList(),
            chapters.Select(ToChapterDto).ToList(),
            designCounts.WorldRules,
            designCounts.Characters,
            designCounts.Factions,
            designCounts.Locations,
            designCounts.Outlines,
            designCounts.VolumeDesigns,
            designCounts.ChapterPlans,
            designCounts.ChapterBlueprints,
            designCounts.CreativeMaterials,
            request.VolumeCount * request.ChaptersPerVolume,
            GetInitialChapterPlanCount(request),
            plan.RawJson);
    }

    public async Task<IReadOnlyList<NovelSeedPlanSummaryDto>> ListPlansAsync(CancellationToken ct = default)
    {
        var projects = await _db.Projects.AsNoTracking()
            .Where(p => p.CurrentSourceBookId != null)
            .OrderByDescending(p => p.UpdatedAt)
            .Take(100)
            .ToListAsync(ct);
        if (projects.Count == 0) return Array.Empty<NovelSeedPlanSummaryDto>();

        var sourceBookIds = projects
            .Select(p => p.CurrentSourceBookId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct()
            .ToList();
        var projectIds = projects.Select(p => p.Id).ToList();

        var sourceBooks = await _db.SourceBooks.AsNoTracking()
            .Where(s => sourceBookIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, ct);

        var volumeCounts = await _db.Volumes.AsNoTracking()
            .Where(v => projectIds.Contains(v.ProjectId))
            .GroupBy(v => v.ProjectId)
            .Select(g => new { ProjectId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ProjectId, x => x.Count, ct);

        var chapterCounts = await _db.Chapters.AsNoTracking()
            .Where(c => projectIds.Contains(c.ProjectId))
            .GroupBy(c => c.ProjectId)
            .Select(g => new { ProjectId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ProjectId, x => x.Count, ct);

        var sourceStats = await BuildSourceStatsAsync(sourceBookIds, ct);

        return projects
            .Where(project =>
            {
                var source = project.CurrentSourceBookId != null && sourceBooks.TryGetValue(project.CurrentSourceBookId, out var s) ? s : null;
                if (source?.Author == "AI") return true;
                return project.CurrentSourceBookId != null
                       && sourceStats.TryGetValue(project.CurrentSourceBookId, out var stats)
                       && stats.CreativeMaterialCount + stats.ChapterPlanCount + stats.VolumeDesignCount > 0;
            })
            .Select(project =>
            {
                var source = project.CurrentSourceBookId != null && sourceBooks.TryGetValue(project.CurrentSourceBookId, out var s) ? s : null;
                var stats = project.CurrentSourceBookId != null && sourceStats.TryGetValue(project.CurrentSourceBookId, out var st)
                    ? st
                    : SourceStats.Empty;
                var volumeCount = volumeCounts.GetValueOrDefault(project.Id);
                var chapterCount = chapterCounts.GetValueOrDefault(project.Id);
                return new NovelSeedPlanSummaryDto(
                    project.Id,
                    project.Name,
                    project.Description,
                    project.CurrentSourceBookId,
                    source?.Name ?? "未绑定源书",
                    source?.Genre ?? string.Empty,
                    volumeCount,
                    chapterCount,
                    source?.ChapterCount ?? stats.ChapterPlanCount,
                    stats.ChapterPlanCount,
                    stats.WorldRuleCount,
                    stats.CharacterRuleCount,
                    stats.FactionRuleCount,
                    stats.LocationRuleCount,
                    stats.OutlineCount,
                    stats.VolumeDesignCount,
                    stats.ChapterPlanCount,
                    stats.ChapterBlueprintCount,
                    stats.CreativeMaterialCount,
                    BuildAnnouncement(project, source, stats, volumeCount),
                    project.CreatedAt,
                    project.UpdatedAt);
            })
            .ToList();
    }

    public async Task<NovelSeedConversationDto> GetOrCreateConversationAsync(
        string projectId,
        string? providerId = null,
        string? modelCode = null,
        CancellationToken ct = default)
    {
        var project = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == projectId, ct)
            ?? throw new InvalidOperationException($"项目不存在：{projectId}");

        var title = $"开书计划：{project.Name}";
        var session = await _db.ChatSessions
            .Where(x => x.ProjectId == projectId && x.Mode == "plan")
            .OrderByDescending(x => x.LastMessageAt)
            .FirstOrDefaultAsync(ct);

        if (session == null)
        {
            session = new ChatSession
            {
                ProjectId = projectId,
                Title = title,
                Mode = "plan",
                ProviderId = string.IsNullOrWhiteSpace(providerId) ? null : providerId.Trim(),
                ModelCode = string.IsNullOrWhiteSpace(modelCode) ? null : modelCode.Trim(),
                LastMessageAt = DateTime.UtcNow
            };
            _db.ChatSessions.Add(session);
        }
        else
        {
            if (string.IsNullOrWhiteSpace(session.Title)) session.Title = title;
            if (!string.IsNullOrWhiteSpace(providerId)) session.ProviderId = providerId.Trim();
            if (!string.IsNullOrWhiteSpace(modelCode)) session.ModelCode = modelCode.Trim();
        }

        await _db.SaveChangesAsync(ct);
        return new NovelSeedConversationDto(session.Id, projectId, session.Title, session.Mode, session.LastMessageAt);
    }

    private async Task<GeneratedNovelPlan> GeneratePlanAsync(NovelSeedRequest request, string apiKey, CancellationToken ct)
    {
        var runId = string.IsNullOrWhiteSpace(request.RunId) ? Guid.NewGuid().ToString("N") : request.RunId;
        var result = await _ai.StreamAsync(new AiTestRequest
        {
            RunId = runId,
            Endpoint = request.Endpoint,
            ApiKey = apiKey,
            Model = request.Model,
            Temperature = request.Temperature,
            MaxTokens = request.MaxTokens,
            SystemPrompt = "你是网络小说总纲策划。只输出 JSON，不要 Markdown，不要解释。",
            Prompt = BuildPrompt(request)
        }, ct);

        var raw = ExtractJson(result.Content ?? string.Empty);
        var plan = JsonSerializer.Deserialize<GeneratedNovelPlan>(raw, JsonOptions)
                   ?? throw new InvalidOperationException("AI 未返回可解析的小说规划 JSON。");
        plan.RawJson = raw;
        return plan;
    }

    private async Task<Dictionary<string, SourceStats>> BuildSourceStatsAsync(IReadOnlyList<string?> sourceBookIds, CancellationToken ct)
    {
        var ids = sourceBookIds.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x!).Distinct().ToList();
        var result = ids.ToDictionary(id => id, _ => SourceStats.Empty);
        if (ids.Count == 0) return result;

        foreach (var item in await CountBySourceAsync(_db.WorldRules.AsNoTracking().Where(x => ids.Contains(x.SourceBookId!)), ct))
            result[item.SourceBookId] = result[item.SourceBookId] with { WorldRuleCount = item.Count };
        foreach (var item in await CountBySourceAsync(_db.CharacterRules.AsNoTracking().Where(x => ids.Contains(x.SourceBookId!)), ct))
            result[item.SourceBookId] = result[item.SourceBookId] with { CharacterRuleCount = item.Count };
        foreach (var item in await CountBySourceAsync(_db.FactionRules.AsNoTracking().Where(x => ids.Contains(x.SourceBookId!)), ct))
            result[item.SourceBookId] = result[item.SourceBookId] with { FactionRuleCount = item.Count };
        foreach (var item in await CountBySourceAsync(_db.LocationRules.AsNoTracking().Where(x => ids.Contains(x.SourceBookId!)), ct))
            result[item.SourceBookId] = result[item.SourceBookId] with { LocationRuleCount = item.Count };
        foreach (var item in await CountBySourceAsync(_db.Outlines.AsNoTracking().Where(x => ids.Contains(x.SourceBookId!)), ct))
            result[item.SourceBookId] = result[item.SourceBookId] with { OutlineCount = item.Count };
        foreach (var item in await CountBySourceAsync(_db.VolumeDesigns.AsNoTracking().Where(x => ids.Contains(x.SourceBookId!)), ct))
            result[item.SourceBookId] = result[item.SourceBookId] with { VolumeDesignCount = item.Count };
        foreach (var item in await CountBySourceAsync(_db.ChapterPlans.AsNoTracking().Where(x => ids.Contains(x.SourceBookId!)), ct))
            result[item.SourceBookId] = result[item.SourceBookId] with { ChapterPlanCount = item.Count };
        foreach (var item in await CountBySourceAsync(_db.ChapterBlueprints.AsNoTracking().Where(x => ids.Contains(x.SourceBookId!)), ct))
            result[item.SourceBookId] = result[item.SourceBookId] with { ChapterBlueprintCount = item.Count };
        foreach (var item in await CountBySourceAsync(_db.CreativeMaterials.AsNoTracking().Where(x => ids.Contains(x.SourceBookId!)), ct))
            result[item.SourceBookId] = result[item.SourceBookId] with { CreativeMaterialCount = item.Count };

        return result;
    }

    private static Task<List<SourceCount>> CountBySourceAsync<T>(IQueryable<T> query, CancellationToken ct) where T : TM.Web.Domain.Common.BusinessDataBase
        => query
            .Where(x => x.SourceBookId != null)
            .GroupBy(x => x.SourceBookId!)
            .Select(g => new SourceCount(g.Key, g.Count()))
            .ToListAsync(ct);

    private static string BuildAnnouncement(Project project, SourceBook? source, SourceStats stats, int volumeCount)
    {
        var totalChapters = source?.ChapterCount > 0 ? source.ChapterCount : stats.ChapterPlanCount;
        return $"《{project.Name}》开书计划已建立：{volumeCount} 卷 / {totalChapters} 章，已沉淀角色 {stats.CharacterRuleCount}、势力 {stats.FactionRuleCount}、地点 {stats.LocationRuleCount}、章节计划 {stats.ChapterPlanCount}、蓝图 {stats.ChapterBlueprintCount}。可继续在会话中补充世界观、人物关系、卷节奏或重写规划。";
    }

    private static string BuildPrompt(NovelSeedRequest request)
    {
        var totalChapters = request.VolumeCount * request.ChaptersPerVolume;
        var volumeSampleLimit = Math.Min(request.VolumeCount, 24);
        var chapterSampleLimit = Math.Min(GetInitialChapterPlanCount(request), 60);

        return $$"""
        请根据用户描述生成一个可直接落库的网络小说项目规划 JSON。

        用户描述：
        {{request.Description}}

        约束：
        - 类型：{{FirstNonEmpty(request.Genre, "由描述判断")}}
        - 风格：{{FirstNonEmpty(request.Tone, "清晰、商业化、可连载")}}
        - 目标读者：{{FirstNonEmpty(request.TargetAudience, "网络小说读者")}}
        - 卷数：{{request.VolumeCount}}
        - 每卷章节数：{{request.ChaptersPerVolume}}
        - 每章预计字数：{{request.EstimatedWordsPerChapter}}
        - 必须生成完整大观方向：世界观、力量/技术体系、核心矛盾、主要人物、势力、关键地点、长篇主线阶段。
        - volumes 只生成前 {{volumeSampleLimit}} 卷的代表性卷设计；后端会按模式补齐剩余卷设计。
        - chapters 只生成代表性章节规划，不要生成全书所有章节。
        - chapters 总数不超过 {{chapterSampleLimit}} 条；后端只创建首批章节计划/蓝图，其余章节以后按卷/批次生成。
        - chapters.number 使用全书绝对章节号，例如第 2 卷第 1 章是 {{request.ChaptersPerVolume + 1}}。
        - 全书总章节数为 {{totalChapters}}；不要为了列出全部章节导致截断。

        只返回 JSON，结构必须如下：
        {
          "projectTitle": "书名",
          "logline": "一句话卖点",
          "genre": "类型",
          "theme": "主题",
          "tone": "风格",
          "world": {
            "name": "世界观名称",
            "oneLineSummary": "一句话世界观",
            "powerSystem": "力量/技术体系",
            "cosmology": "宇宙观/社会结构",
            "specialLaws": "特殊规则",
            "hardRules": "不可违反的硬规则",
            "softRules": "软规则",
            "ancientEra": "过去历史",
            "keyEvents": "关键历史事件",
            "modernHistory": "近代背景",
            "statusQuo": "开篇现状"
          },
          "characters": [
            {
              "name": "角色名",
              "type": "主角/配角/反派",
              "gender": "性别",
              "age": "年龄",
              "identity": "身份",
              "appearance": "外观",
              "want": "外在欲望",
              "need": "内在需求",
              "flawBelief": "缺陷信念",
              "growthPath": "成长路径",
              "abilities": "能力",
              "signatureItems": "标志物"
            }
          ],
          "factions": [
            {
              "name": "势力名",
              "type": "势力类型",
              "goal": "目标",
              "territory": "地盘/资源",
              "leader": "领袖",
              "coreMembers": "核心成员",
              "allies": "盟友",
              "enemies": "敌人"
            }
          ],
          "locations": [
            {
              "name": "地点名",
              "type": "地点类型",
              "description": "描述",
              "scale": "规模",
              "terrain": "地貌",
              "climate": "氛围/气候",
              "landmarks": ["地标"],
              "resources": ["资源"],
              "dangers": ["危险"]
            }
          ],
          "volumes": [
            {
              "number": 1,
              "title": "卷名",
              "theme": "卷主题",
              "stageGoal": "阶段目标",
              "mainConflict": "主冲突",
              "openingState": "开局状态",
              "endingState": "结尾状态",
              "keyEvents": "关键事件"
            }
          ],
          "chapters": [
            {
              "number": 1,
              "volumeNumber": 1,
              "title": "章节标题",
              "summary": "章节摘要",
              "mainGoal": "章节目标",
              "macroPhase": "起/承/转/合",
              "tacticalArcId": "弧光1.1",
              "tacticalArcTitle": "战术弧光标题",
              "chapterType": "主线/峰值/缓冲-对话/缓冲-线索/缓冲-代价",
              "conflictScore": "★★★☆☆",
              "coreEvent": "本章必须发生的核心事件",
              "allowedEntities": ["本章准入实体"],
              "conflict": "阻力来源",
              "keyTurn": "关键转折",
              "hook": "章节钩子",
              "statusMarkers": "【状态：xxx】或留空",
              "temporalAnchor": "时间锚点",
              "spatialAnchor": "地点锚点",
              "timelineCoordinate": "四维时空坐标",
              "isSingularityEvent": false,
              "bufferRole": "缓冲职责或留空",
              "foreshadowingTier": "Tier-1/Tier-2/Tier-3 或留空",
              "foreshadowingRole": "埋设/推进/回收/校准 或留空",
              "characters": ["出场角色"],
              "factions": ["出场势力"],
              "locations": ["出场地点"]
            }
          ]
        }
        """;
    }

    private static IEnumerable<Volume> CreateVolumes(string projectId, NovelSeedRequest request, GeneratedNovelPlan plan)
    {
        var source = plan.Volumes.Count > 0 ? plan.Volumes : new List<GeneratedVolumePlan>();
        for (var i = 1; i <= request.VolumeCount; i++)
        {
            var item = source.FirstOrDefault(x => x.Number == i)
                       ?? BuildFallbackVolumePlan(i, request, plan);
            yield return new Volume
            {
                ProjectId = projectId,
                VolumeNumber = i,
                Title = FirstNonEmpty(item.Title, $"第 {i} 卷"),
                Theme = BlankToNull(item.Theme),
                MilestoneText = BlankToNull(FirstNonEmpty(item.StageGoal, item.EndingState))
            };
        }
    }

    private static IEnumerable<Chapter> CreateChapters(
        string projectId,
        IReadOnlyList<Volume> volumes,
        NovelSeedRequest request,
        GeneratedNovelPlan plan)
    {
        var total = Math.Min(request.VolumeCount * request.ChaptersPerVolume, GetInitialChapterPlanCount(request));
        for (var i = 1; i <= total; i++)
        {
            var volumeNumber = ((i - 1) / request.ChaptersPerVolume) + 1;
            var volume = volumes.First(v => v.VolumeNumber == volumeNumber);
            var item = NormalizeChapterPlan(
                plan.Chapters.FirstOrDefault(x => x.Number == i),
                i,
                volumeNumber,
                request,
                plan);
            yield return new Chapter
            {
                ProjectId = projectId,
                VolumeId = volume.Id,
                ChapterNumber = i,
                Title = FirstNonEmpty(item.Title, $"第 {i} 章"),
                Summary = FirstNonEmpty(item.Summary, item.MainGoal),
                Status = "planned",
                WordCount = 0,
                ContentFilePath = Path.Combine("projects", projectId, "chapters", $"{Guid.NewGuid():N}.md").Replace('\\', '/')
            };
        }
    }

    private static IEnumerable<GeneratedChapterPlan> BuildPlanningChapters(NovelSeedRequest request, GeneratedNovelPlan plan)
    {
        var total = GetInitialChapterPlanCount(request);
        for (var i = 1; i <= total; i++)
        {
            var volumeNumber = ((i - 1) / request.ChaptersPerVolume) + 1;
            yield return NormalizeChapterPlan(
                plan.Chapters.FirstOrDefault(x => x.Number == i),
                i,
                volumeNumber,
                request,
                plan);
        }
    }

    private static int GetInitialChapterPlanCount(NovelSeedRequest request)
        => Math.Clamp(request.InitialChapterPlanCount, 0, Math.Min(500, request.VolumeCount * request.ChaptersPerVolume));

    private static GeneratedVolumePlan BuildFallbackVolumePlan(int volumeNumber, NovelSeedRequest request, GeneratedNovelPlan plan)
    {
        var phase = GetVolumePhase(volumeNumber, request.VolumeCount);
        return new GeneratedVolumePlan
        {
            Number = volumeNumber,
            Title = $"第 {volumeNumber} 卷 {phase.TitleSuffix}",
            Theme = FirstNonEmpty(phase.Theme, plan.Theme, "长篇主线推进"),
            StageGoal = phase.StageGoal,
            MainConflict = FirstNonEmpty(phase.Conflict, plan.Logline),
            OpeningState = phase.OpeningState,
            EndingState = phase.EndingState,
            KeyEvents = phase.KeyEvents
        };
    }

    private static (string TitleSuffix, string Theme, string StageGoal, string Conflict, string OpeningState, string EndingState, string KeyEvents)
        GetVolumePhase(int volumeNumber, int totalVolumes)
    {
        var ratio = (double)volumeNumber / Math.Max(1, totalVolumes);
        if (volumeNumber <= 1)
            return ("开局卷", "入局与立身", "建立主角初始目标、核心关系和第一轮危机。", "主角被卷入世界核心矛盾。", "主角处于弱势和未知状态。", "主角获得第一块立足资源。", "入局、试探、第一次反击。");
        if (ratio < 0.25)
            return ("扩张卷", "能力成长与地图展开", "扩展世界地图、势力关系和能力体系。", "主角成长速度与外部秩序发生冲突。", "主角开始拥有主动权。", "主角进入更高层级舞台。", "新地图、新盟友、新敌人。");
        if (ratio < 0.55)
            return ("风暴卷", "多线冲突升级", "让主线、人物关系和势力博弈全面升级。", "旧秩序主动围剿主角阵营。", "主角拥有阶段成果。", "主角付出代价并获得关键真相。", "围剿、背叛、真相揭露。");
        if (ratio < 0.8)
            return ("反转卷", "真相与代价", "揭开深层真相并改写主角目标。", "主角目标与世界真相发生冲突。", "主角以为接近胜利。", "主角发现真正敌人或真正代价。", "反转、牺牲、目标重塑。");
        if (volumeNumber < totalVolumes)
            return ("终局前卷", "资源整合与终局铺垫", "整合资源，处理遗留伏笔，推向最终对抗。", "所有关键势力围绕终局站队。", "主角开始掌握全局。", "最终战条件被凑齐。", "回收伏笔、阵营站队、终局门槛。");
        return ("终局卷", "终局决战与余波", "完成最终对抗并交代世界新秩序。", "主角和最终矛盾正面对撞。", "终局危机爆发。", "新秩序建立并留下余韵。", "最终战、清算、余波。");
    }

    private static GeneratedChapterPlan BuildFallbackChapterPlan(
        int chapterNumber,
        int volumeNumber,
        NovelSeedRequest request,
        GeneratedNovelPlan plan)
    {
        var volume = plan.Volumes.FirstOrDefault(x => x.Number == volumeNumber) ?? new GeneratedVolumePlan();
        var chapterInVolume = ((chapterNumber - 1) % request.ChaptersPerVolume) + 1;
        var stage = GetChapterStage(chapterInVolume, request.ChaptersPerVolume);
        var title = $"第 {chapterNumber} 章 {FirstNonEmpty(stage.TitleSuffix, volume.Theme, volume.Title, "阶段推进")}";
        var volumeTitle = FirstNonEmpty(volume.Title, $"第 {volumeNumber} 卷");
        var theme = FirstNonEmpty(volume.Theme, plan.Theme, "主线推进");
        var conflict = FirstNonEmpty(volume.MainConflict, plan.Logline, "主角目标与外部阻力持续升级");
        var characterNames = plan.Characters.Select(x => x.Name).Where(x => !string.IsNullOrWhiteSpace(x)).Take(3).ToList();
        var factionNames = plan.Factions.Select(x => x.Name).Where(x => !string.IsNullOrWhiteSpace(x)).Take(2).ToList();
        var locationNames = plan.Locations.Select(x => x.Name).Where(x => !string.IsNullOrWhiteSpace(x)).Take(2).ToList();
        var primaryCharacter = PickByChapter(characterNames, chapterInVolume);
        var primaryFaction = PickByChapter(factionNames, chapterInVolume);
        var primaryLocation = PickByChapter(locationNames, chapterInVolume);
        var action = GetChapterAction(chapterInVolume, request.ChaptersPerVolume);
        var concreteGoal = FirstNonEmpty(volume.StageGoal, $"推进{volumeTitle}的阶段目标");
        var coreEvent = BuildFallbackCoreEvent(primaryCharacter, primaryFaction, primaryLocation, action, concreteGoal, chapterInVolume);
        var summary = BuildFallbackSummary(volumeTitle, chapterInVolume, theme, coreEvent, conflict, stage.KeyTurn, stage.Hook);

        return new GeneratedChapterPlan
        {
            Number = chapterNumber,
            VolumeNumber = volumeNumber,
            Title = title,
            Summary = summary,
            MainGoal = coreEvent,
            MacroPhase = stage.Phase,
            TacticalArcId = $"弧光{volumeNumber}.{Math.Max(1, (int)Math.Ceiling((double)chapterInVolume / Math.Max(1, request.ChaptersPerVolume / 4)))}",
            TacticalArcTitle = stage.TitleSuffix,
            ChapterType = stage.ChapterType,
            ConflictScore = stage.ConflictScore,
            CoreEvent = coreEvent,
            AllowedEntities = characterNames.Concat(factionNames).Concat(locationNames).ToList(),
            Conflict = conflict,
            KeyTurn = stage.KeyTurn,
            Hook = stage.Hook,
            TemporalAnchor = $"第 {volumeNumber} 卷第 {chapterInVolume} 章时段",
            SpatialAnchor = locationNames.FirstOrDefault() ?? string.Empty,
            TimelineCoordinate = $"卷{volumeNumber}/章{chapterNumber}/阶段{stage.Phase}",
            IsSingularityEvent = chapterInVolume == request.ChaptersPerVolume,
            BufferRole = stage.BufferRole,
            ForeshadowingTier = stage.ChapterType.Contains("线索", StringComparison.OrdinalIgnoreCase) ? "Tier-2" : string.Empty,
            ForeshadowingRole = stage.ChapterType.Contains("线索", StringComparison.OrdinalIgnoreCase) ? "推进" : string.Empty,
            Characters = characterNames,
            Factions = factionNames,
            Locations = locationNames
        };
    }

    private static GeneratedChapterPlan NormalizeChapterPlan(
        GeneratedChapterPlan? source,
        int chapterNumber,
        int volumeNumber,
        NovelSeedRequest request,
        GeneratedNovelPlan plan)
    {
        var fallback = BuildFallbackChapterPlan(chapterNumber, volumeNumber, request, plan);
        if (source == null) return fallback;

        source.Number = source.Number > 0 ? source.Number : chapterNumber;
        source.VolumeNumber = source.VolumeNumber > 0 ? source.VolumeNumber : volumeNumber;
        source.Title = FirstNonEmpty(source.Title, fallback.Title);
        source.Summary = FirstNonEmpty(source.Summary, fallback.Summary);
        source.MainGoal = FirstNonEmpty(source.MainGoal, fallback.MainGoal);
        source.MacroPhase = FirstNonEmpty(source.MacroPhase, fallback.MacroPhase);
        source.TacticalArcId = FirstNonEmpty(source.TacticalArcId, fallback.TacticalArcId);
        source.TacticalArcTitle = FirstNonEmpty(source.TacticalArcTitle, fallback.TacticalArcTitle);
        source.ChapterType = FirstNonEmpty(source.ChapterType, fallback.ChapterType);
        source.ConflictScore = FirstNonEmpty(source.ConflictScore, fallback.ConflictScore);
        source.CoreEvent = FirstNonEmpty(source.CoreEvent, source.Summary, fallback.CoreEvent);
        source.AllowedEntities = source.AllowedEntities.Count > 0
            ? source.AllowedEntities
            : fallback.AllowedEntities;
        source.Conflict = FirstNonEmpty(source.Conflict, fallback.Conflict);
        source.KeyTurn = FirstNonEmpty(source.KeyTurn, fallback.KeyTurn);
        source.Hook = FirstNonEmpty(source.Hook, fallback.Hook);
        source.StatusMarkers = FirstNonEmpty(source.StatusMarkers, $"阶段:{source.MacroPhase};类型:{source.ChapterType}");
        source.TemporalAnchor = FirstNonEmpty(source.TemporalAnchor, fallback.TemporalAnchor);
        source.SpatialAnchor = FirstNonEmpty(source.SpatialAnchor, fallback.SpatialAnchor);
        source.TimelineCoordinate = FirstNonEmpty(source.TimelineCoordinate, fallback.TimelineCoordinate);
        source.IsSingularityEvent = source.IsSingularityEvent || fallback.IsSingularityEvent;
        source.BufferRole = FirstNonEmpty(source.BufferRole, fallback.BufferRole);
        source.ForeshadowingTier = FirstNonEmpty(source.ForeshadowingTier, fallback.ForeshadowingTier);
        source.ForeshadowingRole = FirstNonEmpty(source.ForeshadowingRole, fallback.ForeshadowingRole);
        source.Characters = source.Characters.Count > 0 ? source.Characters : fallback.Characters;
        source.Factions = source.Factions.Count > 0 ? source.Factions : fallback.Factions;
        source.Locations = source.Locations.Count > 0 ? source.Locations : fallback.Locations;
        return source;
    }

    internal static IReadOnlyList<string> BuildFallbackChapterSummariesForTest(NovelSeedRequest request)
    {
        var plan = new GeneratedNovelPlan
        {
            ProjectTitle = "测试书",
            Logline = "主角调查尸潮源头并对抗财团封锁。",
            Theme = "觉醒、打脸、建立道法克尸认知",
            Characters =
            {
                new GeneratedCharacterPlan { Name = "许易明" },
                new GeneratedCharacterPlan { Name = "沈栀" },
                new GeneratedCharacterPlan { Name = "白僵群" }
            },
            Factions =
            {
                new GeneratedFactionPlan { Name = "潮汐财团" },
                new GeneratedFactionPlan { Name = "火属学生团" }
            },
            Locations =
            {
                new GeneratedLocationPlan { Name = "第三潮汐塔" },
                new GeneratedLocationPlan { Name = "地下管道" }
            },
            Volumes =
            {
                new GeneratedVolumePlan
                {
                    Number = 1,
                    Title = "第一卷 觉醒试炼",
                    Theme = "觉醒、打脸、建立道法克尸认知",
                    StageGoal = "收集线索、建立关系并暴露阻力",
                    MainConflict = "潮汐财团封锁真相，白僵群持续突袭。"
                }
            }
        };

        var total = Math.Min(request.InitialChapterPlanCount, request.ChaptersPerVolume);
        return Enumerable.Range(1, total)
            .Select(i => BuildFallbackChapterPlan(i, 1, request, plan).Summary)
            .ToList();
    }

    private static (string Phase, string TitleSuffix, string Summary, string KeyTurn, string Hook, string ChapterType, string ConflictScore, string BufferRole)
        GetChapterStage(int chapterInVolume, int chaptersPerVolume)
    {
        if (chapterInVolume <= 1)
        {
            return ("起", "开局落点", "建立本卷新局面、新目标与即时压力。", "主角发现本卷核心问题并被迫入局。", "新的线索或危机在章末出现。", "主线", "★★★☆☆", string.Empty);
        }

        var ratio = (double)chapterInVolume / Math.Max(1, chaptersPerVolume);
        if (ratio < 0.25)
        {
            return ("起", "线索展开", "围绕阶段目标搜集线索、建立关系并暴露阻力。", "关键角色或势力改变主角的行动路径。", "更高层级的阻力浮出水面。", "缓冲-线索", "★★☆☆☆", "线索滴灌");
        }
        if (ratio < 0.55)
        {
            return ("承", "冲突升级", "主角主动推进计划，代价、误判和外部压迫同步加重。", "原计划被反制，主角必须调整策略。", "胜利条件被重新定义。", "主线", "★★★☆☆", string.Empty);
        }
        if (ratio < 0.8)
        {
            return ("转", "反转压迫", "本卷主冲突进入高压段，隐藏真相和人物选择开始碰撞。", "关键真相改变敌我格局。", "主角获得机会，同时暴露更大风险。", "峰值", "★★★★☆", string.Empty);
        }
        if (chapterInVolume < chaptersPerVolume)
        {
            return ("合", "决战前夜", "本卷矛盾收束，主角整合资源并付出明确代价。", "主角做出不可回头的选择。", "最终冲突被推到眼前。", "缓冲-代价", "★★★★☆", "峰前代价");
        }

        return ("合", "卷末收束", "解决本卷阶段冲突，留下下一卷的新问题。", "本卷目标达成或失败，但世界格局被改变。", "新的长期危机或奖励在结尾出现。", "峰值", "★★★★★", string.Empty);
    }

    private static string PickByChapter(IReadOnlyList<string> values, int chapterInVolume)
        => values.Count == 0 ? string.Empty : values[(chapterInVolume - 1) % values.Count];

    private static string GetChapterAction(int chapterInVolume, int chaptersPerVolume)
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
        if (chapterInVolume >= chaptersPerVolume) return actions[^1];
        return actions[(chapterInVolume - 1) % actions.Length];
    }

    private static string BuildFallbackCoreEvent(
        string character,
        string faction,
        string location,
        string action,
        string goal,
        int chapterInVolume)
    {
        var actor = FirstNonEmpty(character, "主角");
        var place = string.IsNullOrWhiteSpace(location) ? string.Empty : $"在{location}";
        var opponent = string.IsNullOrWhiteSpace(faction) ? string.Empty : $"，同时牵出{faction}的反应";
        var focus = BuildChapterFocus(chapterInVolume);
        return $"{actor}{place}{action}，以{focus}作为切口，推进“{goal}”{opponent}";
    }

    private static string BuildChapterFocus(int chapterInVolume)
    {
        var evidenceKinds = new[] { "异常符痕", "目击证词", "尸气残留", "账册缺口", "阵法回响" };
        var pressureKinds = new[] { "封锁压力", "舆论误导", "资源断供", "身份暴露", "时间倒逼", "同伴分歧", "敌方试探" };
        var choiceKinds = new[] { "试探", "交换", "潜入", "反制" };
        return $"{evidenceKinds[(chapterInVolume - 1) % evidenceKinds.Length]}、{pressureKinds[(chapterInVolume - 1) % pressureKinds.Length]}与{choiceKinds[(chapterInVolume - 1) % choiceKinds.Length]}";
    }

    private static string BuildFallbackSummary(
        string volumeTitle,
        int chapterInVolume,
        string theme,
        string coreEvent,
        string conflict,
        string keyTurn,
        string hook)
        => $"{volumeTitle}第 {chapterInVolume} 章，{coreEvent}。主题落在“{theme}”；阻力来自{TrimSentenceEnd(conflict)}。转折：{TrimSentenceEnd(keyTurn)}；章末钩子：{TrimSentenceEnd(hook)}";

    private static string TrimSentenceEnd(string value)
        => value.Trim().TrimEnd('。', '；', ';', '.', '，', ',');

    private DesignCounts CreateDesignData(
        string sourceBookId,
        NovelSeedRequest request,
        GeneratedNovelPlan plan,
        IReadOnlyList<Volume> volumes,
        IReadOnlyList<Chapter> chapters)
    {
        var counts = new DesignCounts();

        _db.WorldRules.Add(new WorldRule
        {
            Name = FirstNonEmpty(plan.World.Name, "核心世界观"),
            SourceBookId = sourceBookId,
            Category = "AI 开书",
            OneLineSummary = plan.World.OneLineSummary,
            PowerSystem = plan.World.PowerSystem,
            Cosmology = plan.World.Cosmology,
            SpecialLaws = plan.World.SpecialLaws,
            HardRules = plan.World.HardRules,
            SoftRules = plan.World.SoftRules,
            AncientEra = plan.World.AncientEra,
            KeyEvents = plan.World.KeyEvents,
            ModernHistory = plan.World.ModernHistory,
            StatusQuo = plan.World.StatusQuo
        });
        counts.WorldRules++;

        foreach (var c in plan.Characters.Take(12))
        {
            _db.CharacterRules.Add(new CharacterRule
            {
                Name = FirstNonEmpty(c.Name, "未命名角色"),
                SourceBookId = sourceBookId,
                Category = "AI 开书",
                CharacterType = c.Type,
                Gender = c.Gender,
                Age = c.Age,
                Identity = c.Identity,
                Appearance = c.Appearance,
                Want = c.Want,
                Need = c.Need,
                FlawBelief = c.FlawBelief,
                GrowthPath = c.GrowthPath,
                SpecialAbilities = c.Abilities,
                SignatureItems = c.SignatureItems
            });
            counts.Characters++;
        }

        foreach (var f in plan.Factions.Take(8))
        {
            _db.FactionRules.Add(new FactionRule
            {
                Name = FirstNonEmpty(f.Name, "未命名势力"),
                SourceBookId = sourceBookId,
                Category = "AI 开书",
                FactionType = f.Type,
                Goal = f.Goal,
                StrengthTerritory = f.Territory,
                Leader = f.Leader,
                CoreMembers = f.CoreMembers,
                Allies = f.Allies,
                Enemies = f.Enemies
            });
            counts.Factions++;
        }

        foreach (var l in plan.Locations.Take(12))
        {
            _db.LocationRules.Add(new LocationRule
            {
                Name = FirstNonEmpty(l.Name, "未命名地点"),
                SourceBookId = sourceBookId,
                Category = "AI 开书",
                LocationType = l.Type,
                Description = l.Description,
                Scale = l.Scale,
                Terrain = l.Terrain,
                Climate = l.Climate,
                Landmarks = l.Landmarks,
                Resources = l.Resources,
                Dangers = l.Dangers
            });
            counts.Locations++;
        }

        _db.Outlines.Add(new Outline
        {
            Name = "AI 生成全书大纲",
            SourceBookId = sourceBookId,
            Category = "AI 开书",
            TotalChapterCount = request.VolumeCount * request.ChaptersPerVolume,
            EstimatedWordCount = $"{request.VolumeCount * request.ChaptersPerVolume * request.EstimatedWordsPerChapter}",
            OneLineOutline = plan.Logline,
            EmotionalTone = FirstNonEmpty(plan.Tone, request.Tone),
            Theme = plan.Theme,
            CoreConflict = string.Join("；", plan.Volumes.Select(x => x.MainConflict).Where(x => !string.IsNullOrWhiteSpace(x))),
            EndingState = plan.Volumes.LastOrDefault()?.EndingState ?? string.Empty,
            VolumeDivision = string.Join("\n", plan.Volumes.Select(x => $"第{x.Number}卷：{x.Title} - {x.Theme}")),
            OutlineOverview = plan.World.OneLineSummary
        });
        counts.Outlines++;

        foreach (var volume in volumes)
        {
            var item = plan.Volumes.FirstOrDefault(x => x.Number == volume.VolumeNumber) ?? new GeneratedVolumePlan();
            var start = ((volume.VolumeNumber - 1) * request.ChaptersPerVolume) + 1;
            var end = volume.VolumeNumber * request.ChaptersPerVolume;
            _db.VolumeDesigns.Add(new VolumeDesign
            {
                Name = volume.Title,
                SourceBookId = sourceBookId,
                Category = "AI 开书",
                VolumeNumber = volume.VolumeNumber,
                VolumeTitle = volume.Title,
                VolumeTheme = FirstNonEmpty(item.Theme, volume.Theme),
                StageGoal = item.StageGoal,
                EstimatedWordCount = $"{request.ChaptersPerVolume * request.EstimatedWordsPerChapter}",
                TargetChapterCount = request.ChaptersPerVolume,
                StartChapter = start,
                EndChapter = end,
                MainConflict = item.MainConflict,
                KeyEvents = item.KeyEvents,
                OpeningState = item.OpeningState,
                EndingState = item.EndingState,
                ChapterAllocationOverview = $"第 {start}-{end} 章",
                ChapterGenerationHints = $"每章约 {request.EstimatedWordsPerChapter} 字"
            });
            counts.VolumeDesigns++;
        }

        _db.CreativeMaterials.Add(new CreativeMaterial
        {
            Name = "AI 开书创意素材",
            SourceBookId = sourceBookId,
            Category = "AI 开书",
            SourceBookName = FirstNonEmpty(plan.ProjectTitle, "AI 新小说"),
            Genre = FirstNonEmpty(plan.Genre, request.Genre),
            OverallIdea = plan.Logline,
            WorldBuildingMethod = plan.World.Cosmology,
            PowerSystemDesign = plan.World.PowerSystem,
            EnvironmentDescription = FirstNonEmpty(plan.World.StatusQuo, plan.World.OneLineSummary),
            FactionDesign = string.Join("；", plan.Factions.Select(x => $"{x.Name}:{x.Goal}").Where(x => !string.IsNullOrWhiteSpace(x))),
            WorldviewHighlights = FirstNonEmpty(plan.World.SpecialLaws, plan.World.HardRules),
            ProtagonistDesign = plan.Characters.FirstOrDefault(x => x.Type.Contains("主", StringComparison.OrdinalIgnoreCase))?.GrowthPath
                                ?? plan.Characters.FirstOrDefault()?.GrowthPath
                                ?? string.Empty,
            SupportingRoles = string.Join("；", plan.Characters.Skip(1).Take(6).Select(x => $"{x.Name}:{x.Identity}")),
            CharacterRelations = string.Join("；", plan.Characters.Take(6).Select(x => $"{x.Name}:{x.Want}/{x.Need}")),
            GoldenFingerDesign = string.Join("；", plan.Characters.Take(3).Select(x => x.Abilities).Where(x => !string.IsNullOrWhiteSpace(x))),
            CharacterHighlights = string.Join("；", plan.Characters.Take(6).Select(GetCharacterFlavorText).Where(x => !string.IsNullOrWhiteSpace(x))),
            PlotStructure = string.Join("\n", plan.Volumes.Select(x => $"第{x.Number}卷 {x.Title}: {x.StageGoal}")),
            ConflictDesign = string.Join("；", plan.Volumes.Select(x => x.MainConflict).Where(x => !string.IsNullOrWhiteSpace(x))),
            ClimaxArrangement = plan.Volumes.LastOrDefault()?.EndingState ?? string.Empty,
            ForeshadowingTechnique = "按卷推进伏笔：开局埋线、中段反转、卷末回收并抛出下一卷危机。",
            PlotHighlights = string.Join("；", plan.Volumes.Select(x => x.KeyEvents).Where(x => !string.IsNullOrWhiteSpace(x)))
        });
        counts.CreativeMaterials++;

        foreach (var chapter in BuildPlanningChapters(request, plan))
        {
            var volumeTitle = volumes.First(v => v.VolumeNumber == chapter.VolumeNumber).Title;
            _db.ChapterPlans.Add(new ChapterPlan
            {
                Name = chapter.Title,
                SourceBookId = sourceBookId,
                Category = "AI 开书",
                ChapterTitle = chapter.Title,
                ChapterNumber = chapter.Number,
                Volume = volumeTitle,
                EstimatedWordCount = $"{request.EstimatedWordsPerChapter}",
                ChapterTheme = chapter.Summary,
                MainGoal = chapter.MainGoal,
                MacroPhase = chapter.MacroPhase,
                TacticalArcId = chapter.TacticalArcId,
                TacticalArcTitle = chapter.TacticalArcTitle,
                ChapterType = chapter.ChapterType,
                ConflictScore = chapter.ConflictScore,
                CoreEvent = FirstNonEmpty(chapter.CoreEvent, chapter.Summary),
                AllowedEntities = chapter.AllowedEntities.Count > 0
                    ? chapter.AllowedEntities
                    : chapter.Characters.Concat(chapter.Factions).Concat(chapter.Locations).ToList(),
                ResistanceSource = chapter.Conflict,
                KeyTurn = chapter.KeyTurn,
                Hook = chapter.Hook,
                StatusMarkers = chapter.StatusMarkers,
                TemporalAnchor = chapter.TemporalAnchor,
                SpatialAnchor = chapter.SpatialAnchor,
                TimelineCoordinate = chapter.TimelineCoordinate,
                IsSingularityEvent = chapter.IsSingularityEvent,
                BufferRole = chapter.BufferRole,
                ForeshadowingTier = chapter.ForeshadowingTier,
                ForeshadowingRole = chapter.ForeshadowingRole,
                MainPlotProgress = chapter.Summary,
                ReferencedCharacterNames = chapter.Characters,
                ReferencedFactionNames = chapter.Factions,
                ReferencedLocationNames = chapter.Locations
            });
            counts.ChapterPlans++;

            _db.ChapterBlueprints.Add(new ChapterBlueprint
            {
                Name = $"{chapter.Title} 蓝图",
                SourceBookId = sourceBookId,
                Category = "AI 开书",
                ChapterId = string.Empty,
                OneLineStructure = chapter.Summary,
                PacingCurve = "开端铺垫 -> 中段推进 -> 末尾钩子",
                SceneNumber = 1,
                SceneTitle = chapter.Title,
                PovCharacter = chapter.Characters.FirstOrDefault() ?? string.Empty,
                EstimatedWordCount = $"{request.EstimatedWordsPerChapter}",
                Opening = chapter.MainGoal,
                Development = chapter.Conflict,
                Turning = chapter.KeyTurn,
                Ending = chapter.Hook,
                InfoDrop = chapter.Summary,
                Cast = string.Join("、", chapter.Characters),
                Locations = string.Join("、", chapter.Locations),
                Factions = string.Join("、", chapter.Factions),
                ItemsClues = chapter.Hook
            });
            counts.ChapterBlueprints++;
        }

        return counts;
    }

    private async Task<string> ResolveApiKeyAsync(NovelSeedRequest request, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(request.ApiKeyId))
        {
            return await _apiKeys.GetPlainKeyAsync(request.ApiKeyId, ct)
                   ?? throw new InvalidOperationException("指定 API Key 不存在。");
        }

        if (!string.IsNullOrWhiteSpace(request.ProviderId))
        {
            return await _apiKeys.RotateNextPlainKeyAsync(request.ProviderId, ct)
                   ?? throw new InvalidOperationException("当前 Provider 没有可用 API Key。");
        }

        if (!string.IsNullOrWhiteSpace(request.ConfigId))
        {
            return await _apiKeys.RotateNextPlainKeyAsync(request.ConfigId, ct)
                   ?? throw new InvalidOperationException("当前配置没有可用 API Key。");
        }

        if (!string.IsNullOrWhiteSpace(request.ApiKey))
        {
            return request.ApiKey;
        }

        throw new InvalidOperationException("请选择已保存的 API Key，或填写临时 API Key。");
    }

    private static void Validate(NovelSeedRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Description))
            throw new InvalidOperationException("小说描述不能为空。");
        if (string.IsNullOrWhiteSpace(request.Endpoint))
            throw new InvalidOperationException("Endpoint 不能为空。");
        if (string.IsNullOrWhiteSpace(request.Model))
            throw new InvalidOperationException("模型不能为空。");

        request.VolumeCount = Math.Clamp(request.VolumeCount, 1, 200);
        request.ChaptersPerVolume = Math.Clamp(request.ChaptersPerVolume, 1, 500);
        if (request.VolumeCount * request.ChaptersPerVolume > 10_000)
        {
            throw new InvalidOperationException("当前开书最多支持 10000 章规模，请降低卷数或每卷章节数。");
        }
        request.InitialChapterPlanCount = Math.Clamp(request.InitialChapterPlanCount, 0, Math.Min(500, request.VolumeCount * request.ChaptersPerVolume));
        request.EstimatedWordsPerChapter = Math.Clamp(request.EstimatedWordsPerChapter, 1000, 20000);
        request.MaxTokens = Math.Clamp(request.MaxTokens ?? 6000, 1500, 30000);
    }

    private static string ExtractJson(string text)
    {
        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        if (start < 0 || end <= start)
            throw new InvalidOperationException("AI 返回内容不是 JSON。");
        return text[start..(end + 1)];
    }

    private string UniqueProjectName(string baseName)
    {
        var name = baseName.Trim();
        if (!_db.Projects.Any(p => p.Name == name)) return name;

        for (var i = 2; i < 1000; i++)
        {
            var candidate = $"{name} {i}";
            if (!_db.Projects.Any(p => p.Name == candidate)) return candidate;
        }

        return $"{name} {DateTime.Now:yyyyMMddHHmmss}";
    }

    private static string GuessProjectName(string description)
        => description.Split(new[] { '\n', '\r', '。', '.', '，', ',' }, StringSplitOptions.RemoveEmptyEntries)
            .FirstOrDefault()?.Trim() is { Length: > 0 } title
            ? title[..Math.Min(title.Length, 18)]
            : "AI 新小说";

    private static string FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim() ?? string.Empty;

    private static string? BlankToNull(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string GetCharacterFlavorText(GeneratedCharacterPlan character)
        => FirstNonEmpty(character.Appearance, character.Abilities, character.SignatureItems, character.Identity);

    private static ProjectDto ToProjectDto(Project p)
        => new(p.Id, p.Name, p.Description, p.CurrentSourceBookId, p.Version, p.LastModifiedAt, p.CreatedAt, p.UpdatedAt);

    private static VolumeDto ToVolumeDto(Volume v)
        => new(v.Id, v.ProjectId, v.VolumeNumber, v.Title, v.Theme, v.MilestoneText, v.CreatedAt, v.UpdatedAt);

    private static ChapterDto ToChapterDto(Chapter c)
        => new(c.Id, c.ProjectId, c.VolumeId, c.ChapterNumber, c.Title, c.WordCount, c.Summary, string.Empty, c.ContentFilePath, c.Status, c.CreatedAt, c.UpdatedAt);

    private sealed class DesignCounts
    {
        public int WorldRules { get; set; }
        public int Characters { get; set; }
        public int Factions { get; set; }
        public int Locations { get; set; }
        public int Outlines { get; set; }
        public int VolumeDesigns { get; set; }
        public int ChapterPlans { get; set; }
        public int ChapterBlueprints { get; set; }
        public int CreativeMaterials { get; set; }
    }

    private sealed record SourceCount(string SourceBookId, int Count);

    private sealed record SourceStats(
        int WorldRuleCount,
        int CharacterRuleCount,
        int FactionRuleCount,
        int LocationRuleCount,
        int OutlineCount,
        int VolumeDesignCount,
        int ChapterPlanCount,
        int ChapterBlueprintCount,
        int CreativeMaterialCount)
    {
        public static SourceStats Empty { get; } = new(0, 0, 0, 0, 0, 0, 0, 0, 0);
    }

    private sealed class GeneratedNovelPlan
    {
        public string RawJson { get; set; } = string.Empty;
        public string ProjectTitle { get; set; } = string.Empty;
        public string Logline { get; set; } = string.Empty;
        public string Genre { get; set; } = string.Empty;
        public string Theme { get; set; } = string.Empty;
        public string Tone { get; set; } = string.Empty;
        public GeneratedWorldPlan World { get; set; } = new();
        public List<GeneratedCharacterPlan> Characters { get; set; } = new();
        public List<GeneratedFactionPlan> Factions { get; set; } = new();
        public List<GeneratedLocationPlan> Locations { get; set; } = new();
        public List<GeneratedVolumePlan> Volumes { get; set; } = new();
        public List<GeneratedChapterPlan> Chapters { get; set; } = new();
    }

    private sealed class GeneratedWorldPlan
    {
        public string Name { get; set; } = string.Empty;
        public string OneLineSummary { get; set; } = string.Empty;
        public string PowerSystem { get; set; } = string.Empty;
        public string Cosmology { get; set; } = string.Empty;
        public string SpecialLaws { get; set; } = string.Empty;
        public string HardRules { get; set; } = string.Empty;
        public string SoftRules { get; set; } = string.Empty;
        public string AncientEra { get; set; } = string.Empty;
        public string KeyEvents { get; set; } = string.Empty;
        public string ModernHistory { get; set; } = string.Empty;
        public string StatusQuo { get; set; } = string.Empty;
    }

    private sealed class GeneratedCharacterPlan
    {
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Gender { get; set; } = string.Empty;
        public string Age { get; set; } = string.Empty;
        public string Identity { get; set; } = string.Empty;
        public string Appearance { get; set; } = string.Empty;
        public string Want { get; set; } = string.Empty;
        public string Need { get; set; } = string.Empty;
        public string FlawBelief { get; set; } = string.Empty;
        public string GrowthPath { get; set; } = string.Empty;
        public string Abilities { get; set; } = string.Empty;
        public string SignatureItems { get; set; } = string.Empty;
    }

    private sealed class GeneratedFactionPlan
    {
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Goal { get; set; } = string.Empty;
        public string Territory { get; set; } = string.Empty;
        public string Leader { get; set; } = string.Empty;
        public string CoreMembers { get; set; } = string.Empty;
        public string Allies { get; set; } = string.Empty;
        public string Enemies { get; set; } = string.Empty;
    }

    private sealed class GeneratedLocationPlan
    {
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Scale { get; set; } = string.Empty;
        public string Terrain { get; set; } = string.Empty;
        public string Climate { get; set; } = string.Empty;
        public List<string> Landmarks { get; set; } = new();
        public List<string> Resources { get; set; } = new();
        public List<string> Dangers { get; set; } = new();
    }

    private sealed class GeneratedVolumePlan
    {
        public int Number { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Theme { get; set; } = string.Empty;
        public string StageGoal { get; set; } = string.Empty;
        public string MainConflict { get; set; } = string.Empty;
        public string OpeningState { get; set; } = string.Empty;
        public string EndingState { get; set; } = string.Empty;
        public string KeyEvents { get; set; } = string.Empty;
    }

    private sealed class GeneratedChapterPlan
    {
        public int Number { get; set; }
        public int VolumeNumber { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Summary { get; set; } = string.Empty;
        public string MainGoal { get; set; } = string.Empty;
        public string MacroPhase { get; set; } = string.Empty;
        public string TacticalArcId { get; set; } = string.Empty;
        public string TacticalArcTitle { get; set; } = string.Empty;
        public string ChapterType { get; set; } = string.Empty;
        public string ConflictScore { get; set; } = string.Empty;
        public string CoreEvent { get; set; } = string.Empty;
        public List<string> AllowedEntities { get; set; } = new();
        public string Conflict { get; set; } = string.Empty;
        public string KeyTurn { get; set; } = string.Empty;
        public string Hook { get; set; } = string.Empty;
        public string StatusMarkers { get; set; } = string.Empty;
        public string TemporalAnchor { get; set; } = string.Empty;
        public string SpatialAnchor { get; set; } = string.Empty;
        public string TimelineCoordinate { get; set; } = string.Empty;
        public bool IsSingularityEvent { get; set; }
        public string BufferRole { get; set; } = string.Empty;
        public string ForeshadowingTier { get; set; } = string.Empty;
        public string ForeshadowingRole { get; set; } = string.Empty;
        public List<string> Characters { get; set; } = new();
        public List<string> Factions { get; set; } = new();
        public List<string> Locations { get; set; } = new();
    }
}
