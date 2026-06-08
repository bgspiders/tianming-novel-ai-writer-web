using System.Text.Json;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;
using TM.Web.Domain.Common;
using TM.Web.Domain.Entities.Core;
using TM.Web.Domain.Entities.Design;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Domain.Entities.Metadata;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Generation;

public sealed class ContextPackagingService : IContextPackagingService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private const int MaxFieldChars = 500;
    private const int MaxSectionChars = 5000;
    private const int PreviousEndingChars = 800;

    private readonly AppDbContext _db;
    private readonly string _storageRoot;
    private readonly IChapterRecallService? _chapterRecall;

    public ContextPackagingService(
        AppDbContext db,
        IConfiguration configuration,
        IChapterRecallService? chapterRecall = null)
    {
        _db = db;
        _storageRoot = DbServiceCollectionExtensions.ResolveStorageRoot(configuration);
        _chapterRecall = chapterRecall;
    }

    public async Task<PackageContextResult> PackageAsync(PackageContextRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.ProjectId))
        {
            throw new ArgumentException("项目 ID 不能为空。", nameof(request));
        }

        var project = await _db.Projects.FirstOrDefaultAsync(x => x.Id == request.ProjectId, ct)
            ?? throw new InvalidOperationException($"项目不存在：{request.ProjectId}");

        var sourceBookId = string.IsNullOrWhiteSpace(request.SourceBookId)
            ? project.CurrentSourceBookId
            : request.SourceBookId;

        var fileEntries = await BuildFileEntriesAsync(request.ProjectId, sourceBookId, ct);
        var enabledModules = fileEntries
            .Select(static x => x.ModuleKey)
            .Distinct()
            .OrderBy(static x => x)
            .ToList();

        project.Version += 1;
        project.LastModifiedAt = DateTime.UtcNow;

        var manifest = new Manifest
        {
            ProjectId = project.Id,
            Version = project.Version,
            SourceBookId = sourceBookId,
            PublishedAt = DateTime.UtcNow,
            Files = JsonSerializer.Serialize(fileEntries.Select(static x => new { path = x.Path, sha256 = x.Hash }), JsonOptions),
            EnabledModules = JsonSerializer.Serialize(enabledModules, JsonOptions),
            Statistics = JsonSerializer.Serialize(BuildStatistics(fileEntries), JsonOptions)
        };

        _db.Manifests.Add(manifest);
        await _db.SaveChangesAsync(ct);

        return new PackageContextResult(
            manifest.Id,
            manifest.ProjectId,
            manifest.Version,
            manifest.SourceBookId,
            manifest.PublishedAt,
            FileCount: fileEntries.Count,
            EnabledModuleCount: enabledModules.Count,
            manifest.Statistics);
    }

    public async Task<GenerationContextResult> BuildGenerationContextAsync(GenerationContextRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.ProjectId))
        {
            throw new ArgumentException("项目 ID 不能为空。", nameof(request));
        }

        if (string.IsNullOrWhiteSpace(request.ChapterId))
        {
            throw new ArgumentException("章节 ID 不能为空。", nameof(request));
        }

        var project = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.ProjectId, ct)
            ?? throw new InvalidOperationException($"项目不存在：{request.ProjectId}");
        var sourceBookId = string.IsNullOrWhiteSpace(request.SourceBookId)
            ? project.CurrentSourceBookId
            : request.SourceBookId;
        var chapter = await _db.Chapters.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.ChapterId && x.ProjectId == request.ProjectId, ct)
            ?? throw new InvalidOperationException("章节不存在或不属于当前项目。");
        var volume = await _db.Volumes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == chapter.VolumeId, ct);

        var plan = await FilterBusinessBySourceBook(
                _db.ChapterPlans.AsNoTracking().Where(x => x.IsEnabled),
                sourceBookId)
            .Where(x => x.ChapterNumber == chapter.ChapterNumber)
            .OrderByDescending(x => x.UpdatedAt)
            .FirstOrDefaultAsync(ct);
        var blueprints = await FilterBusinessBySourceBook(
                _db.ChapterBlueprints.AsNoTracking().Where(x => x.IsEnabled),
                sourceBookId)
            .Where(x => x.ChapterId == chapter.Id)
            .OrderBy(x => x.SceneNumber)
            .ThenBy(x => x.SceneTitle)
            .ToListAsync(ct);
        var currentBlueprint = request.SceneNumber.HasValue
            ? blueprints.FirstOrDefault(x => x.SceneNumber == request.SceneNumber.Value)
            : null;

        var sections = new List<GenerationContextSectionDto>
        {
            BuildP0(chapter, plan, currentBlueprint ?? blueprints.FirstOrDefault()),
            await BuildP1Async(chapter, volume, sourceBookId, request.RecentChapterCount, ct),
            await BuildP2Async(project.Id, chapter.Id, sourceBookId, chapter.ChapterNumber, plan, currentBlueprint ?? blueprints.FirstOrDefault(), ct),
            await BuildP3Async(project.Id, sourceBookId, ct)
        };

        foreach (var section in sections)
        {
            section.Content = Truncate(section.Content, MaxSectionChars);
        }

        return new GenerationContextResult
        {
            ProjectId = project.Id,
            ChapterId = chapter.Id,
            SceneNumber = request.SceneNumber,
            SourceBookId = sourceBookId,
            Sections = sections,
            ContextText = string.Join("\n\n", sections.Select(RenderSection).Where(x => !string.IsNullOrWhiteSpace(x)))
        };
    }

    private async Task<List<PackageFileEntry>> BuildFileEntriesAsync(string projectId, string? sourceBookId, CancellationToken ct)
    {
        var files = new List<PackageFileEntry>();

        async Task addAsync<T>(IQueryable<T> query, string moduleKey) where T : class
        {
            var rows = await query.ToListAsync(ct);
            if (rows.Count <= 0) return;
            var payload = JsonSerializer.Serialize(rows, JsonOptions);

            files.Add(new PackageFileEntry(
                moduleKey,
                $"context/{moduleKey}.json",
                Sha256(payload)));
        }

        await addAsync(FilterBySourceBook(_db.WorldRules.AsNoTracking().Where(x => x.IsEnabled), sourceBookId), "world_rules");
        await addAsync(FilterBySourceBook(_db.CharacterRules.AsNoTracking().Where(x => x.IsEnabled), sourceBookId), "character_rules");
        await addAsync(FilterBySourceBook(_db.FactionRules.AsNoTracking().Where(x => x.IsEnabled), sourceBookId), "faction_rules");
        await addAsync(FilterBySourceBook(_db.LocationRules.AsNoTracking().Where(x => x.IsEnabled), sourceBookId), "location_rules");
        await addAsync(FilterBySourceBook(_db.PlotRules.AsNoTracking().Where(x => x.IsEnabled), sourceBookId), "plot_rules");
        await addAsync(FilterBySourceBook(_db.CreativeMaterials.AsNoTracking().Where(x => x.IsEnabled), sourceBookId), "creative_materials");
        await addAsync(FilterBySourceBook(_db.Outlines.AsNoTracking().Where(x => x.IsEnabled), sourceBookId), "outlines");
        await addAsync(FilterBySourceBook(_db.VolumeDesigns.AsNoTracking().Where(x => x.IsEnabled), sourceBookId), "volume_designs");
        await addAsync(FilterBySourceBook(_db.ChapterPlans.AsNoTracking().Where(x => x.IsEnabled), sourceBookId), "chapter_plans");
        await addAsync(FilterBySourceBook(_db.ChapterBlueprints.AsNoTracking().Where(x => x.IsEnabled), sourceBookId), "chapter_blueprints");
        await AddKnowledgeBaseFilesAsync(files, projectId, sourceBookId, ct);

        var volumeCount = await _db.Volumes.AsNoTracking().Where(x => x.ProjectId == projectId).CountAsync(ct);
        if (volumeCount > 0)
        {
            files.Add(new PackageFileEntry("volumes", "context/volumes.json", $"count:{volumeCount};project:{projectId}"));
        }

        var chapterCount = await _db.Chapters.AsNoTracking().Where(x => x.ProjectId == projectId).CountAsync(ct);
        if (chapterCount > 0)
        {
            files.Add(new PackageFileEntry("chapters", "context/chapters.json", $"count:{chapterCount};project:{projectId}"));
        }

        return files;
    }

    private static object BuildStatistics(IReadOnlyList<PackageFileEntry> files)
        => new
        {
            fileCount = files.Count,
            generatedAt = DateTime.UtcNow,
            modules = files
                .GroupBy(static x => x.ModuleKey)
                .ToDictionary(static g => g.Key, static g => g.Count())
        };

    private async Task AddKnowledgeBaseFilesAsync(List<PackageFileEntry> files, string projectId, string? sourceBookId, CancellationToken ct)
    {
        var settingsPrefix = $"tianming.kb.{projectId}.{sourceBookId ?? "global"}.";
        var imported = await _db.AppSettings.AsNoTracking()
            .Where(x => x.Key.StartsWith(settingsPrefix))
            .OrderBy(x => x.Key)
            .ToListAsync(ct);
        foreach (var setting in imported)
        {
            var fileKey = setting.Key[settingsPrefix.Length..];
            var path = $"knowledge-base/{fileKey}.md";
            files.Add(new PackageFileEntry($"kb_{fileKey}", path, Sha256(setting.Value)));
        }
    }

    private static string Sha256(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static IQueryable<T> FilterBySourceBook<T>(IQueryable<T> query, string? sourceBookId) where T : class
    {
        if (string.IsNullOrWhiteSpace(sourceBookId))
        {
            return query;
        }

        return query.Where(x => EF.Property<string?>(x, "SourceBookId") == sourceBookId);
    }

    private static IQueryable<T> FilterBusinessBySourceBook<T>(IQueryable<T> query, string? sourceBookId)
        where T : BusinessDataBase
        => string.IsNullOrWhiteSpace(sourceBookId)
            ? query
            : query.Where(x => x.SourceBookId == sourceBookId);

    private GenerationContextSectionDto BuildP0(Chapter chapter, ChapterPlan? plan, ChapterBlueprint? blueprint)
    {
        var lines = new List<string>
        {
            $"章节：第 {chapter.ChapterNumber} 章《{FirstNonEmpty(plan?.ChapterTitle, chapter.Title)}》"
        };
        AddLine(lines, "章节主题", plan?.ChapterTheme);
        AddLine(lines, "读者体验目标", plan?.ReaderExperienceGoal);
        AddLine(lines, "主目标", plan?.MainGoal);
        AddLine(lines, "章节类型", plan?.ChapterType);
        AddLine(lines, "核心事件", plan?.CoreEvent);
        AddLine(lines, "冲突值", plan?.ConflictScore);
        AddLine(lines, "宏观阶段", plan?.MacroPhase);
        AddLine(lines, "战术弧光", FirstNonEmpty(plan?.TacticalArcId, plan?.TacticalArcTitle));
        AddLine(lines, "关键转折", plan?.KeyTurn);
        AddLine(lines, "章末钩子", plan?.Hook);
        AddLine(lines, "准入实体", JoinList(plan?.AllowedEntities));
        AddLine(lines, "出场角色", JoinList(plan?.ReferencedCharacterNames));
        AddLine(lines, "出场势力", JoinList(plan?.ReferencedFactionNames));
        AddLine(lines, "出场地点", JoinList(plan?.ReferencedLocationNames));

        if (blueprint != null)
        {
            lines.Add($"当前场景：{blueprint.SceneNumber}. {FirstNonEmpty(blueprint.SceneTitle, blueprint.Name)}");
            AddLine(lines, "场景结构", blueprint.OneLineStructure);
            AddLine(lines, "场景开场", blueprint.Opening);
            AddLine(lines, "场景发展", blueprint.Development);
            AddLine(lines, "场景转折", blueprint.Turning);
            AddLine(lines, "场景收束", blueprint.Ending);
            AddLine(lines, "信息增量", blueprint.InfoDrop);
            AddLine(lines, "场景角色", blueprint.Cast);
            AddLine(lines, "场景地点", blueprint.Locations);
        }

        return new GenerationContextSectionDto
        {
            Level = "P0",
            Title = "核心上下文",
            Content = string.Join("\n", lines.Where(x => !string.IsNullOrWhiteSpace(x)))
        };
    }

    private async Task<GenerationContextSectionDto> BuildP1Async(Chapter chapter, Volume? volume, string? sourceBookId, int recentChapterCount, CancellationToken ct)
    {
        var lines = new List<string>();
        if (volume != null)
        {
            AddLine(lines, "当前卷", $"第 {volume.VolumeNumber} 卷《{volume.Title}》");
            AddLine(lines, "当前卷主题", volume.Theme);
            AddLine(lines, "当前卷目标", volume.MilestoneText);
        }

        var take = Math.Clamp(recentChapterCount, 3, 20);
        var recentChapters = await _db.Chapters.AsNoTracking()
            .Where(x => x.ProjectId == chapter.ProjectId && x.ChapterNumber < chapter.ChapterNumber)
            .OrderByDescending(x => x.ChapterNumber)
            .Take(take)
            .OrderBy(x => x.ChapterNumber)
            .ToListAsync(ct);
        if (recentChapters.Count > 0)
        {
            lines.Add("最近章节摘要：");
            lines.AddRange(recentChapters.Select(x => $"- 第{x.ChapterNumber}章《{x.Title}》：{Truncate(FirstNonEmpty(x.Summary, $"状态 {x.Status}"), 260)}"));

            var previous = recentChapters.LastOrDefault();
            var ending = await ReadChapterEndingAsync(previous?.ContentFilePath, ct);
            if (!string.IsNullOrWhiteSpace(ending))
            {
                AddLine(lines, "上一章结尾", ending);
            }
        }

        var states = await _db.CharacterStateEntries.AsNoTracking()
            .Where(x => x.ProjectId == chapter.ProjectId)
            .Where(x => string.IsNullOrWhiteSpace(sourceBookId) || x.SourceBookId == sourceBookId)
            .OrderByDescending(x => x.UpdatedAt)
            .Take(8)
            .ToListAsync(ct);
        if (states.Count > 0)
        {
            lines.Add("活跃角色状态：");
            lines.AddRange(states.Select(x => $"- {x.Name}：{Truncate(x.BaseProfile, 240)}"));
        }

        var characterRules = await FilterBusinessBySourceBook(
                _db.CharacterRules.AsNoTracking().Where(x => x.IsEnabled),
                sourceBookId)
            .OrderBy(x => x.Name)
            .Take(8)
            .ToListAsync(ct);
        if (characterRules.Count > 0)
        {
            lines.Add("角色规则：");
            lines.AddRange(characterRules.Select(RenderCharacterRule));
        }

        return new GenerationContextSectionDto
        {
            Level = "P1",
            Title = "重要上下文",
            Content = string.Join("\n", lines.Where(x => !string.IsNullOrWhiteSpace(x)))
        };
    }

    private async Task<GenerationContextSectionDto> BuildP2Async(
        string projectId,
        string chapterId,
        string? sourceBookId,
        int chapterNumber,
        ChapterPlan? plan,
        ChapterBlueprint? blueprint,
        CancellationToken ct)
    {
        var lines = new List<string>();
        var recallQuery = BuildRecallQuery(plan, blueprint);
        if (_chapterRecall != null)
        {
            var recall = await _chapterRecall.RecallAsync(chapterId, recallQuery, 6, ct);
            if (recall?.Results.Count > 0)
            {
                lines.Add("相关记忆 Top-K：");
                lines.AddRange(recall.Results.Select(x =>
                    $"- 第{x.ChapterNumber}章《{x.ChapterTitle}》：{Truncate(x.Summary, 260)}；命中：{JoinList(x.MatchedKeywords)}；原因：{Truncate(x.Reason, 180)}"));
            }
        }

        var imported = await LoadKnowledgeBaseAsync(projectId, sourceBookId, ct);
        if (imported.TryGetValue("archive_events", out var archiveEvents))
        {
            var locked = ExtractLines(archiveEvents, "锁定", "不可改写", "事实", "已发生")
                .Take(10)
                .ToList();
            if (locked.Count > 0)
            {
                lines.Add("锁定事实/档案事件：");
                lines.AddRange(locked.Select(x => $"- {Truncate(x, 320)}"));
            }
        }

        var foreshadowings = await _db.Foreshadowings.AsNoTracking()
            .Where(x => x.ProjectId == projectId && !x.IsResolved)
            .Where(x => string.IsNullOrWhiteSpace(sourceBookId) || x.SourceBookId == sourceBookId)
            .OrderByDescending(x => x.IsOverdue)
            .ThenBy(x => x.ExpectedPayoffChapter)
            .Take(12)
            .ToListAsync(ct);
        if (foreshadowings.Count > 0)
        {
            lines.Add("未回收伏笔：");
            lines.AddRange(foreshadowings.Select(x =>
                $"- [{x.Tier}] {x.Name}，预计回收：{FirstNonEmpty(x.ExpectedPayoffChapter, "未设置")}，状态：{(x.IsOverdue ? "已逾期" : "未回收")}"));
        }

        var timeline = await _db.ChapterTimelines.AsNoTracking()
            .Where(x => x.ProjectId == projectId)
            .Where(x => string.IsNullOrWhiteSpace(sourceBookId) || x.SourceBookId == sourceBookId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(8)
            .ToListAsync(ct);
        if (timeline.Count > 0)
        {
            lines.Add("近期时间线：");
            lines.AddRange(timeline.OrderBy(x => x.CreatedAt).Select(x => $"- {FirstNonEmpty(x.TimePeriod, x.ElapsedTime, "未标记时间")}：{Truncate(x.KeyTimeEvent, 260)}"));
        }

        return new GenerationContextSectionDto
        {
            Level = "P2",
            Title = "召回与伏笔上下文",
            Content = string.Join("\n", lines.Where(x => !string.IsNullOrWhiteSpace(x)))
        };
    }

    private async Task<GenerationContextSectionDto> BuildP3Async(string projectId, string? sourceBookId, CancellationToken ct)
    {
        var lines = new List<string>();
        var settings = await LoadGenerationSettingsAsync(projectId, sourceBookId, ct);
        if (settings.Count > 0)
        {
            lines.Add("生成模式与平台规则：");
            foreach (var setting in settings)
            {
                lines.Add($"- {setting.Key}：{Truncate(setting.Value, 320)}");
            }
        }

        var imported = await LoadKnowledgeBaseAsync(projectId, sourceBookId, ct);
        if (imported.TryGetValue("world_rules", out var importedWorldRules))
        {
            lines.Add("五件套世界观规则：");
            lines.Add(Truncate(importedWorldRules, 900));
        }
        if (imported.TryGetValue("style_sample", out var styleSample))
        {
            lines.Add("五件套文风样本：");
            lines.Add(Truncate(styleSample, 900));
        }

        var worldRules = await FilterBusinessBySourceBook(
                _db.WorldRules.AsNoTracking().Where(x => x.IsEnabled),
                sourceBookId)
            .OrderBy(x => x.Name)
            .Take(8)
            .ToListAsync(ct);
        if (worldRules.Count > 0)
        {
            lines.Add("世界与硬规则：");
            lines.AddRange(worldRules.Select(RenderWorldRule));
        }

        var materials = await FilterBusinessBySourceBook(
                _db.CreativeMaterials.AsNoTracking().Where(x => x.IsEnabled),
                sourceBookId)
            .OrderByDescending(x => x.UpdatedAt)
            .Take(3)
            .ToListAsync(ct);
        if (materials.Count > 0)
        {
            lines.Add("文风/素材参考：");
            lines.AddRange(materials.Select(x =>
                $"- {x.Name}：{Truncate(FirstNonEmpty(x.Genre, x.OverallIdea, x.PlotStructure, x.ConflictDesign), 320)}"));
        }

        return new GenerationContextSectionDto
        {
            Level = "P3",
            Title = "风格与规则上下文",
            Content = string.Join("\n", lines.Where(x => !string.IsNullOrWhiteSpace(x)))
        };
    }

    private async Task<Dictionary<string, string>> LoadKnowledgeBaseAsync(string projectId, string? sourceBookId, CancellationToken ct)
    {
        var prefix = $"tianming.kb.{projectId}.{sourceBookId ?? "global"}.";
        return await _db.AppSettings.AsNoTracking()
            .Where(x => x.Key.StartsWith(prefix))
            .ToDictionaryAsync(x => x.Key[prefix.Length..], x => x.Value, ct);
    }

    private async Task<Dictionary<string, string>> LoadGenerationSettingsAsync(string projectId, string? sourceBookId, CancellationToken ct)
    {
        var generalGenerationPrefix = $"generation.{projectId}.";
        var scopedGenerationPrefix = $"generation.{projectId}.{sourceBookId ?? "global"}.";
        var generalPlatformPrefix = $"platform.{projectId}.";
        var scopedPlatformPrefix = $"platform.{projectId}.{sourceBookId ?? "global"}.";
        var settings = await _db.AppSettings.AsNoTracking()
            .Where(x =>
                x.Key.StartsWith(scopedGenerationPrefix)
                || x.Key.StartsWith(scopedPlatformPrefix)
                || x.Key.StartsWith(generalGenerationPrefix)
                || x.Key.StartsWith(generalPlatformPrefix))
            .OrderBy(x => x.Key)
            .Take(20)
            .ToListAsync(ct);

        return settings.ToDictionary(x => x.Key, x => x.Value);
    }

    private static IEnumerable<string> ExtractLines(string markdown, params string[] keywords)
        => markdown
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(line => keywords.Any(keyword => line.Contains(keyword, StringComparison.OrdinalIgnoreCase)))
            .Select(line => line.TrimStart('-', '*', ' ', '\t'));

    private static string RenderSection(GenerationContextSectionDto section)
        => string.IsNullOrWhiteSpace(section.Content)
            ? $"# {section.Level} {section.Title}\n暂无可用资料。"
            : $"# {section.Level} {section.Title}\n{section.Content}";

    private static string RenderCharacterRule(CharacterRule rule)
    {
        var parts = new[]
        {
            rule.Identity,
            rule.Want,
            rule.Need,
            rule.CombatSkills,
            rule.SpecialAbilities
        }.Where(x => !string.IsNullOrWhiteSpace(x));
        return $"- {rule.Name}：{Truncate(string.Join("；", parts), 300)}";
    }

    private static string RenderWorldRule(WorldRule rule)
    {
        var parts = new[]
        {
            rule.OneLineSummary,
            rule.PowerSystem,
            rule.SpecialLaws,
            rule.HardRules
        }.Where(x => !string.IsNullOrWhiteSpace(x));
        return $"- {rule.Name}：{Truncate(string.Join("；", parts), 360)}";
    }

    private static void AddLine(List<string> lines, string label, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            lines.Add($"- {label}：{Truncate(value, MaxFieldChars)}");
        }
    }

    private static string JoinList(IEnumerable<string>? values)
        => values == null
            ? string.Empty
            : string.Join("、", values.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).Distinct(StringComparer.OrdinalIgnoreCase));

    private static string BuildRecallQuery(ChapterPlan? plan, ChapterBlueprint? blueprint)
    {
        var parts = new[]
        {
            plan?.ChapterTitle,
            plan?.ChapterTheme,
            plan?.MainGoal,
            plan?.CoreEvent,
            plan?.Hook,
            JoinList(plan?.AllowedEntities),
            JoinList(plan?.ReferencedCharacterNames),
            JoinList(plan?.ReferencedFactionNames),
            JoinList(plan?.ReferencedLocationNames),
            blueprint?.SceneTitle,
            blueprint?.OneLineStructure,
            blueprint?.Opening,
            blueprint?.InfoDrop,
            blueprint?.Cast,
            blueprint?.Locations
        };
        return string.Join(" ", parts.Where(x => !string.IsNullOrWhiteSpace(x))).Trim();
    }

    private static string FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim() ?? string.Empty;

    private static string Truncate(string? value, int maxChars)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var normalized = value.Trim();
        return normalized.Length <= maxChars ? normalized : normalized[..maxChars] + "...";
    }

    private async Task<string> ReadChapterEndingAsync(string? relativePath, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(relativePath)) return string.Empty;
        var fullPath = Path.Combine(_storageRoot, relativePath.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(fullPath)) return string.Empty;
        var content = await File.ReadAllTextAsync(fullPath, ct);
        if (string.IsNullOrWhiteSpace(content)) return string.Empty;
        var normalized = content.Trim();
        return normalized.Length <= PreviousEndingChars
            ? normalized
            : normalized[^PreviousEndingChars..];
    }

    private sealed record PackageFileEntry(string ModuleKey, string Path, string Hash);
}
