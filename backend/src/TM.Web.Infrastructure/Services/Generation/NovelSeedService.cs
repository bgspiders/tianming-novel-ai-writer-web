using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Core;
using TM.Web.Domain.Entities.Design;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Infrastructure.Persistence;

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
              "conflict": "阻力来源",
              "keyTurn": "关键转折",
              "hook": "章节钩子",
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
            var item = plan.Chapters.FirstOrDefault(x => x.Number == i)
                       ?? BuildFallbackChapterPlan(i, volumeNumber, request, plan);
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
            yield return plan.Chapters.FirstOrDefault(x => x.Number == i)
                         ?? BuildFallbackChapterPlan(i, volumeNumber, request, plan);
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

        return new GeneratedChapterPlan
        {
            Number = chapterNumber,
            VolumeNumber = volumeNumber,
            Title = title,
            Summary = $"{volumeTitle}第 {chapterInVolume} 章，围绕“{theme}”推进：{stage.Summary}",
            MainGoal = FirstNonEmpty(volume.StageGoal, $"推进{volumeTitle}的阶段目标"),
            Conflict = conflict,
            KeyTurn = stage.KeyTurn,
            Hook = stage.Hook,
            Characters = characterNames,
            Factions = factionNames,
            Locations = locationNames
        };
    }

    private static (string TitleSuffix, string Summary, string KeyTurn, string Hook) GetChapterStage(int chapterInVolume, int chaptersPerVolume)
    {
        if (chapterInVolume <= 1)
        {
            return ("开局落点", "建立本卷新局面、新目标与即时压力。", "主角发现本卷核心问题并被迫入局。", "新的线索或危机在章末出现。");
        }

        var ratio = (double)chapterInVolume / Math.Max(1, chaptersPerVolume);
        if (ratio < 0.25)
        {
            return ("线索展开", "围绕阶段目标搜集线索、建立关系并暴露阻力。", "关键角色或势力改变主角的行动路径。", "更高层级的阻力浮出水面。");
        }
        if (ratio < 0.55)
        {
            return ("冲突升级", "主角主动推进计划，代价、误判和外部压迫同步加重。", "原计划被反制，主角必须调整策略。", "胜利条件被重新定义。");
        }
        if (ratio < 0.8)
        {
            return ("反转压迫", "本卷主冲突进入高压段，隐藏真相和人物选择开始碰撞。", "关键真相改变敌我格局。", "主角获得机会，同时暴露更大风险。");
        }
        if (chapterInVolume < chaptersPerVolume)
        {
            return ("决战前夜", "本卷矛盾收束，主角整合资源并付出明确代价。", "主角做出不可回头的选择。", "最终冲突被推到眼前。");
        }

        return ("卷末收束", "解决本卷阶段冲突，留下下一卷的新问题。", "本卷目标达成或失败，但世界格局被改变。", "新的长期危机或奖励在结尾出现。");
    }

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
                ResistanceSource = chapter.Conflict,
                KeyTurn = chapter.KeyTurn,
                Hook = chapter.Hook,
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
        public string Conflict { get; set; } = string.Empty;
        public string KeyTurn { get; set; } = string.Empty;
        public string Hook { get; set; } = string.Empty;
        public List<string> Characters { get; set; } = new();
        public List<string> Factions { get; set; } = new();
        public List<string> Locations { get; set; } = new();
    }
}
