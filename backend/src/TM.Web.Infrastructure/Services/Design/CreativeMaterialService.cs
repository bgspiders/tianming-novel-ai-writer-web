using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Design;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Design;

public class CreativeMaterialService : ICreativeMaterialService
{
    private readonly AppDbContext _db;
    private static readonly string[] DefaultVolumeTitles = ["起势卷", "升级卷", "决战卷"];

    public CreativeMaterialService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<CreativeMaterialDto>> ListAsync(DesignListQuery query, CancellationToken ct = default)
    {
        query = await _db.ResolveProjectScopeAsync(query, ct);
        var rows = await _db.CreativeMaterials.AsQueryable().ApplyFilter(query).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<PagedResult<CreativeMaterialDto>> ListPagedAsync(DesignListQuery query, CancellationToken ct = default)
    {
        query = await _db.ResolveProjectScopeAsync(query, ct);
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var filtered = _db.CreativeMaterials.AsQueryable().ApplyFilter(query);
        var total = await filtered.CountAsync(ct);
        var rows = await filtered.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return new PagedResult<CreativeMaterialDto>(rows.Select(Map).ToList(), total, page, pageSize);
    }

    public async Task<CreativeMaterialDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.CreativeMaterials.FindAsync(new object?[] { id }, ct);
        return e == null ? null : Map(e);
    }

    public async Task<CreativeMaterialDto> CreateAsync(CreativeMaterialUpsertDto input, CancellationToken ct = default)
    {
        var sourceBookId = await _db.ResolveWriteSourceBookIdAsync(input.ProjectId, input.SourceBookId, ct);
        var e = new CreativeMaterial();
        Apply(e, input, sourceBookId);
        _db.CreativeMaterials.Add(e);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task<CreativeMaterialDto> CreateFromBookAnalysisAsync(string bookAnalysisId, CancellationToken ct = default)
    {
        var analysis = await _db.BookAnalyses.FirstOrDefaultAsync(x => x.Id == bookAnalysisId, ct)
            ?? throw new InvalidOperationException("拆书数据不存在。");

        var material = new CreativeMaterial
        {
            Name = BuildCreativeMaterialName(analysis),
            Category = string.Empty,
            CategoryId = null,
            IsEnabled = analysis.IsEnabled,
            SourceBookId = analysis.SourceBookId,
            Icon = "💡",
            SourceBookName = string.IsNullOrWhiteSpace(analysis.SourceBookTitle) ? analysis.Name : analysis.SourceBookTitle,
            Genre = analysis.SourceGenre,
            OverallIdea = BuildOverallIdea(analysis),
            WorldBuildingMethod = analysis.WorldBuildingMethod,
            PowerSystemDesign = analysis.PowerSystemDesign,
            EnvironmentDescription = analysis.EnvironmentDescription,
            FactionDesign = analysis.FactionDesign,
            WorldviewHighlights = analysis.WorldviewHighlights,
            ProtagonistDesign = analysis.ProtagonistDesign,
            SupportingRoles = analysis.SupportingRoles,
            CharacterRelations = analysis.CharacterRelations,
            GoldenFingerDesign = analysis.GoldenFingerDesign,
            CharacterHighlights = analysis.CharacterHighlights,
            PlotStructure = analysis.PlotStructure,
            ConflictDesign = analysis.ConflictDesign,
            ClimaxArrangement = analysis.ClimaxArrangement,
            ForeshadowingTechnique = analysis.ForeshadowingTechnique,
            PlotHighlights = analysis.PlotHighlights
        };

        _db.CreativeMaterials.Add(material);
        await _db.SaveChangesAsync(ct);
        return Map(material);
    }

    public async Task<SkeletonBuildResultDto> BuildSkeletonAsync(string creativeMaterialId, CancellationToken ct = default)
    {
        var material = await _db.CreativeMaterials.FirstOrDefaultAsync(x => x.Id == creativeMaterialId, ct)
            ?? throw new InvalidOperationException("创意素材不存在。");

        var dependencyVersions = BuildDependencyVersions();
        var characterNames = ExtractLines(new[] { material.ProtagonistDesign, material.SupportingRoles }, 4);
        var factionNames = ExtractLines(material.FactionDesign, limit: 3);
        var locationNames = ExtractLines(new[] { material.EnvironmentDescription, material.WorldviewHighlights }, 3);

        var worldRule = BuildWorldRule(material);
        var characterRule = BuildCharacterRule(material, characterNames.FirstOrDefault());
        var factionRule = BuildFactionRule(material, factionNames.FirstOrDefault());
        var locationRule = BuildLocationRule(material);
        var plotRule = BuildPlotRule(material);

        var outline = BuildOutline(material, dependencyVersions);
        var volumeDesigns = BuildVolumeDesigns(material, dependencyVersions, characterNames, factionNames, locationNames);
        var chapterPlans = BuildChapterPlans(material, dependencyVersions, volumeDesigns, characterNames, factionNames, locationNames);
        var chapterBlueprints = BuildChapterBlueprints(material, dependencyVersions, chapterPlans, characterNames, factionNames, locationNames);

        _db.WorldRules.Add(worldRule);
        _db.CharacterRules.Add(characterRule);
        _db.FactionRules.Add(factionRule);
        _db.LocationRules.Add(locationRule);
        _db.PlotRules.Add(plotRule);
        _db.Outlines.Add(outline);
        _db.VolumeDesigns.AddRange(volumeDesigns);
        _db.ChapterPlans.AddRange(chapterPlans);
        _db.ChapterBlueprints.AddRange(chapterBlueprints);

        await _db.SaveChangesAsync(ct);

        return new SkeletonBuildResultDto(
            material.SourceBookId,
            RuleCount: 5,
            OutlineCount: 1,
            VolumeDesignCount: volumeDesigns.Count,
            ChapterPlanCount: chapterPlans.Count,
            ChapterBlueprintCount: chapterBlueprints.Count);
    }

    public async Task<CreativeMaterialDto> UpdateAsync(string id, CreativeMaterialUpsertDto input, CancellationToken ct = default)
    {
        var e = await _db.CreativeMaterials.FindAsync(new object?[] { id }, ct)
                ?? throw new InvalidOperationException("创意素材不存在。");
        var sourceBookId = await _db.ResolveWriteSourceBookIdAsync(input.ProjectId, input.SourceBookId, ct);
        Apply(e, input, sourceBookId);
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

    private static void Apply(CreativeMaterial e, CreativeMaterialUpsertDto i, string? sourceBookId)
    {
        if (string.IsNullOrWhiteSpace(i.Name)) throw new InvalidOperationException("名称必填。");
        e.Name = i.Name.Trim();
        e.Category = i.Category ?? "";
        e.CategoryId = string.IsNullOrEmpty(i.CategoryId) ? null : i.CategoryId;
        e.IsEnabled = i.IsEnabled;
        e.SourceBookId = sourceBookId;
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

    private static string BuildCreativeMaterialName(BookAnalysis analysis)
    {
        var sourceTitle = string.IsNullOrWhiteSpace(analysis.SourceBookTitle) ? analysis.Name : analysis.SourceBookTitle;
        return string.IsNullOrWhiteSpace(sourceTitle) ? "拆书转创意素材" : $"{sourceTitle} · 创意素材";
    }

    private static string BuildOverallIdea(BookAnalysis analysis)
    {
        var parts = new[]
        {
            string.IsNullOrWhiteSpace(analysis.SourceBookTitle) ? null : $"来源作品：{analysis.SourceBookTitle}",
            string.IsNullOrWhiteSpace(analysis.SourceAuthor) ? null : $"作者：{analysis.SourceAuthor}",
            string.IsNullOrWhiteSpace(analysis.SourceGenre) ? null : $"题材：{analysis.SourceGenre}",
            string.IsNullOrWhiteSpace(analysis.SourceKeywords) ? null : $"关键词：{analysis.SourceKeywords}",
            string.IsNullOrWhiteSpace(analysis.PlotHighlights) ? null : $"亮点：{analysis.PlotHighlights}"
        };

        return string.Join('\n', parts.Where(static x => !string.IsNullOrWhiteSpace(x)));
    }

    private static WorldRule BuildWorldRule(CreativeMaterial material)
        => new()
        {
            Name = $"{material.Name} · 世界规则",
            Category = string.Empty,
            CategoryId = null,
            IsEnabled = material.IsEnabled,
            SourceBookId = material.SourceBookId,
            OneLineSummary = FirstNonEmptyLine(material.WorldBuildingMethod, material.OverallIdea, "围绕主线冲突构建的成长型世界。"),
            PowerSystem = material.PowerSystemDesign,
            Cosmology = FirstNonEmptyLine(material.WorldviewHighlights, "世界观以主角成长和势力博弈为中心推进。"),
            SpecialLaws = FirstNonEmptyLine(material.WorldBuildingMethod, "特殊法则服务于剧情升级与主角突破。"),
            HardRules = FirstNonEmptyLine(material.PowerSystemDesign, "力量体系存在明确门槛与代价。"),
            SoftRules = FirstNonEmptyLine(material.WorldviewHighlights, "规则允许通过人物选择与伏笔反转扩展。"),
            AncientEra = "远古时代奠定世界核心秩序，并埋下当前冲突的根因。",
            KeyEvents = material.PlotHighlights,
            ModernHistory = FirstNonEmptyLine(material.EnvironmentDescription, "近代格局由资源、传承与势力重组塑造。"),
            StatusQuo = material.FactionDesign
        };

    private static CharacterRule BuildCharacterRule(CreativeMaterial material, string? mainCharacter)
        => new()
        {
            Name = $"{material.Name} · 核心角色",
            Category = string.Empty,
            CategoryId = null,
            IsEnabled = material.IsEnabled,
            SourceBookId = material.SourceBookId,
            CharacterType = "Lead",
            Gender = string.Empty,
            Age = string.Empty,
            Identity = FirstNonEmptyLine(material.ProtagonistDesign, "主角"),
            Race = string.Empty,
            Appearance = material.CharacterHighlights,
            Want = FirstNonEmptyLine(material.ProtagonistDesign, "推动个人命运跃迁。"),
            Need = FirstNonEmptyLine(material.GoldenFingerDesign, "学会掌控力量与代价。"),
            FlawBelief = FirstNonEmptyLine(material.CharacterRelations, "需要从自我执念中完成成长。"),
            GrowthPath = material.CharacterHighlights,
            TargetCharacterName = mainCharacter ?? string.Empty,
            RelationshipType = "核心羁绊",
            EmotionDynamic = material.CharacterRelations,
            CombatSkills = material.GoldenFingerDesign,
            NonCombatSkills = material.ProtagonistDesign,
            SpecialAbilities = material.GoldenFingerDesign,
            SignatureItems = material.GoldenFingerDesign,
            CommonItems = string.Empty,
            PersonalAssets = material.CharacterHighlights
        };

    private static FactionRule BuildFactionRule(CreativeMaterial material, string? factionName)
        => new()
        {
            Name = string.IsNullOrWhiteSpace(factionName) ? $"{material.Name} · 核心势力" : factionName,
            Category = string.Empty,
            CategoryId = null,
            IsEnabled = material.IsEnabled,
            SourceBookId = material.SourceBookId,
            FactionType = "核心势力",
            Goal = material.FactionDesign,
            StrengthTerritory = material.EnvironmentDescription,
            Leader = FirstNonEmptyLine(material.ProtagonistDesign, "当前阶段的关键掌权者。"),
            CoreMembers = material.SupportingRoles,
            MemberTraits = material.CharacterHighlights,
            Allies = "与主角阶段性协作的力量。",
            Enemies = material.ConflictDesign,
            NeutralCompetitors = material.WorldviewHighlights
        };

    private static LocationRule BuildLocationRule(CreativeMaterial material)
        => new()
        {
            Name = $"{material.Name} · 核心场域",
            Category = string.Empty,
            CategoryId = null,
            IsEnabled = material.IsEnabled,
            SourceBookId = material.SourceBookId,
            LocationType = "核心舞台",
            Description = material.EnvironmentDescription,
            Scale = "跨区域",
            Terrain = FirstNonEmptyLine(material.EnvironmentDescription, "场景随着剧情升级不断扩展。"),
            Climate = "氛围与剧情冲突同步变化。",
            Landmarks = ExtractLines(material.WorldviewHighlights, limit: 3),
            Resources = ExtractLines(material.PowerSystemDesign, limit: 3),
            HistoricalSignificance = material.WorldBuildingMethod,
            Dangers = ExtractLines(material.ConflictDesign, limit: 3),
            FactionId = null
        };

    private static PlotRule BuildPlotRule(CreativeMaterial material)
        => new()
        {
            Name = $"{material.Name} · 主线剧情规则",
            Category = string.Empty,
            CategoryId = null,
            IsEnabled = material.IsEnabled,
            SourceBookId = material.SourceBookId,
            TargetVolume = "全书主线",
            AssignedVolume = "起势卷",
            OneLineSummary = FirstNonEmptyLine(material.PlotStructure, material.OverallIdea, "主角在持续升级中推进主线冲突。"),
            EventType = "成长主线",
            StoryPhase = "开篇铺垫",
            PrerequisitesTrigger = material.ForeshadowingTechnique,
            MainCharacters = JoinLines(material.ProtagonistDesign, material.SupportingRoles),
            KeyNpcs = material.SupportingRoles,
            Location = FirstNonEmptyLine(material.EnvironmentDescription, "核心舞台"),
            TimeDuration = "长线推进",
            StepTitle = material.PlotStructure,
            Goal = FirstNonEmptyLine(material.PlotHighlights, "推动主线升级并建立中长期目标。"),
            Conflict = material.ConflictDesign,
            Result = material.ClimaxArrangement,
            EmotionCurve = material.CharacterHighlights,
            MainPlotPush = material.PlotHighlights,
            CharacterGrowth = material.CharacterHighlights,
            WorldReveal = material.WorldviewHighlights,
            RewardsClues = material.ForeshadowingTechnique
        };

    private static Outline BuildOutline(CreativeMaterial material, Dictionary<string, int> dependencyVersions)
        => new()
        {
            Name = $"{material.Name} · 全书大纲",
            Category = string.Empty,
            CategoryId = null,
            IsEnabled = material.IsEnabled,
            SourceBookId = material.SourceBookId,
            DependencyModuleVersions = new Dictionary<string, int>(dependencyVersions),
            TotalChapterCount = 12,
            EstimatedWordCount = "24-30 万",
            OneLineOutline = FirstNonEmptyLine(material.OverallIdea, material.PlotStructure, "主角借助独特优势在层层升级中改写命运。"),
            EmotionalTone = FirstNonEmptyLine(material.CharacterHighlights, "爽感与压迫感并进。"),
            PhilosophicalMotif = FirstNonEmptyLine(material.WorldviewHighlights, "力量、秩序与选择的代价。"),
            Theme = FirstNonEmptyLine(material.WorldBuildingMethod, "在高压世界中完成自我塑造。"),
            CoreConflict = material.ConflictDesign,
            EndingState = material.ClimaxArrangement,
            VolumeDivision = "第一卷：起势与立足\n第二卷：升级与破局\n第三卷：决战与重构",
            OutlineOverview = $"{material.PlotStructure}\n\n高潮安排：{material.ClimaxArrangement}\n\n亮点：{material.PlotHighlights}"
        };

    private static List<VolumeDesign> BuildVolumeDesigns(
        CreativeMaterial material,
        Dictionary<string, int> dependencyVersions,
        List<string> characterNames,
        List<string> factionNames,
        List<string> locationNames)
    {
        var themes = SplitIntoSegments(material.PlotStructure, 3);
        var conflicts = SplitIntoSegments(material.ConflictDesign, 3);
        var endings = SplitIntoSegments(material.ClimaxArrangement, 3);
        var highlights = SplitIntoSegments(material.PlotHighlights, 3);

        var volumes = new List<VolumeDesign>();
        var chapterCursor = 1;

        for (var i = 0; i < 3; i++)
        {
            var start = chapterCursor;
            var end = chapterCursor + 3;
            volumes.Add(new VolumeDesign
            {
                Name = $"{material.Name} · 第{i + 1}卷",
                Category = string.Empty,
                CategoryId = null,
                IsEnabled = material.IsEnabled,
                SourceBookId = material.SourceBookId,
                DependencyModuleVersions = new Dictionary<string, int>(dependencyVersions),
                VolumeNumber = i + 1,
                VolumeTitle = DefaultVolumeTitles[i],
                VolumeTheme = themes[i],
                StageGoal = highlights[i],
                EstimatedWordCount = "8-10 万",
                TargetChapterCount = 4,
                StartChapter = start,
                EndChapter = end,
                MainConflict = conflicts[i],
                PressureSource = material.FactionDesign,
                KeyEvents = themes[i],
                OpeningState = i == 0 ? "主角尚未真正站稳脚跟。" : $"承接上一卷结尾，进入第{i + 1}阶段升级。",
                EndingState = endings[i],
                ChapterAllocationOverview = $"第{start}-{end}章围绕“{themes[i]}”展开，逐步抬升冲突与爽点。",
                PlotAllocation = $"前半铺垫资源与对手，后半完成转折与爆点。重点亮点：{highlights[i]}",
                ChapterGenerationHints = $"突出{themes[i]}，同时埋入后续伏笔：{material.ForeshadowingTechnique}",
                ReferencedCharacterNames = characterNames,
                ReferencedFactionNames = factionNames,
                ReferencedLocationNames = locationNames
            });
            chapterCursor += 4;
        }

        return volumes;
    }

    private static List<ChapterPlan> BuildChapterPlans(
        CreativeMaterial material,
        Dictionary<string, int> dependencyVersions,
        IReadOnlyList<VolumeDesign> volumeDesigns,
        List<string> characterNames,
        List<string> factionNames,
        List<string> locationNames)
    {
        var chapterPlans = new List<ChapterPlan>();

        foreach (var volume in volumeDesigns)
        {
            for (var offset = 0; offset < volume.TargetChapterCount; offset++)
            {
                var chapterNumber = volume.StartChapter + offset;
                var stageText = offset switch
                {
                    0 => "开局铺垫",
                    1 => "冲突升级",
                    2 => "关键转折",
                    _ => "收束钩子"
                };

                chapterPlans.Add(new ChapterPlan
                {
                    Name = $"{material.Name} · 第{chapterNumber}章规划",
                    Category = string.Empty,
                    CategoryId = null,
                    IsEnabled = material.IsEnabled,
                    SourceBookId = material.SourceBookId,
                    DependencyModuleVersions = new Dictionary<string, int>(dependencyVersions),
                    ChapterTitle = $"{volume.VolumeTitle}·{stageText}",
                    ChapterNumber = chapterNumber,
                    Volume = volume.VolumeTitle,
                    EstimatedWordCount = "6500-8000",
                    ChapterTheme = volume.VolumeTheme,
                    ReaderExperienceGoal = $"提供“{stageText}”阶段的连续推动与爽点释放。",
                    MainGoal = volume.StageGoal,
                    ResistanceSource = volume.MainConflict,
                    KeyTurn = offset >= 2 ? material.ClimaxArrangement : material.ConflictDesign,
                    Hook = offset == volume.TargetChapterCount - 1 ? material.ForeshadowingTechnique : material.PlotHighlights,
                    WorldInfoDrop = material.WorldBuildingMethod,
                    CharacterArcProgress = material.CharacterHighlights,
                    MainPlotProgress = material.PlotStructure,
                    Foreshadowing = material.ForeshadowingTechnique,
                    ReferencedCharacterNames = characterNames,
                    ReferencedFactionNames = factionNames,
                    ReferencedLocationNames = locationNames
                });
            }
        }

        return chapterPlans;
    }

    private static List<ChapterBlueprint> BuildChapterBlueprints(
        CreativeMaterial material,
        Dictionary<string, int> dependencyVersions,
        IReadOnlyList<ChapterPlan> chapterPlans,
        List<string> characterNames,
        List<string> factionNames,
        List<string> locationNames)
    {
        var povCharacter = characterNames.FirstOrDefault() ?? "主角";
        var cast = characterNames.Count > 0 ? string.Join('、', characterNames) : material.SupportingRoles;
        var locations = locationNames.Count > 0 ? string.Join('、', locationNames) : material.EnvironmentDescription;
        var factions = factionNames.Count > 0 ? string.Join('、', factionNames) : material.FactionDesign;

        return chapterPlans.Select((plan) => new ChapterBlueprint
        {
            Name = $"{plan.Name} · 蓝图",
            Category = string.Empty,
            CategoryId = null,
            IsEnabled = material.IsEnabled,
            SourceBookId = material.SourceBookId,
            DependencyModuleVersions = new Dictionary<string, int>(dependencyVersions),
            ChapterId = string.Empty,
            OneLineStructure = plan.MainGoal,
            PacingCurve = $"{plan.Volume} / 第{plan.ChapterNumber}章：起承转合递进，结尾留钩。",
            SceneNumber = 1,
            SceneTitle = plan.ChapterTitle,
            PovCharacter = povCharacter,
            EstimatedWordCount = plan.EstimatedWordCount,
            Opening = $"开场即切入 {plan.ReaderExperienceGoal}",
            Development = plan.MainPlotProgress,
            Turning = plan.KeyTurn,
            Ending = plan.Hook,
            InfoDrop = plan.WorldInfoDrop,
            Cast = cast,
            Locations = locations,
            Factions = factions,
            ItemsClues = material.GoldenFingerDesign
        }).ToList();
    }

    private static Dictionary<string, int> BuildDependencyVersions()
        => new()
        {
            ["creative_materials"] = 1,
            ["world_rules"] = 1,
            ["character_rules"] = 1,
            ["faction_rules"] = 1,
            ["location_rules"] = 1,
            ["plot_rules"] = 1
        };

    private static string JoinLines(params string[] values)
        => string.Join('\n', values.Where(static value => !string.IsNullOrWhiteSpace(value)));

    private static string FirstNonEmptyLine(params string[] values)
    {
        foreach (var value in values)
        {
            var line = ExtractLines(value, 1).FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(line))
            {
                return line;
            }
        }

        return string.Empty;
    }

    private static List<string> ExtractLines(params string[] values)
        => ExtractLines(values, limit: 5);

    private static List<string> ExtractLines(string value, int limit)
        => ExtractLines(new[] { value }, limit);

    private static List<string> ExtractLines(IEnumerable<string> values, int limit)
    {
        var segments = values
            .Where(static value => !string.IsNullOrWhiteSpace(value))
            .SelectMany(static value => value
                .Split(['\n', '。', '；', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Where(static value => !string.IsNullOrWhiteSpace(value))
            .Distinct()
            .Take(limit)
            .ToList();

        return segments;
    }

    private static string[] SplitIntoSegments(string value, int count)
    {
        var segments = ExtractLines(value, count);
        if (segments.Count == 0)
        {
            segments.Add("主线推进");
        }

        while (segments.Count < count)
        {
            segments.Add(segments[^1]);
        }

        return segments.Take(count).ToArray();
    }
}
