using System.Text.Json;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TM.Web.Application.Dtos.Import;
using TM.Web.Application.Services;
using TM.Web.Domain.Common;
using TM.Web.Domain.Entities.Core;
using TM.Web.Domain.Entities.Design;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Domain.Entities.Global;
using TM.Web.Domain.Entities.Indexing;
using TM.Web.Domain.Entities.Tracking;
using TM.Web.Domain.Entities.Validation;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Import;

/// <summary>
/// 老 JSON → 新 SQLite 的数据导入服务。
///
/// 设计原则：
/// - 直接用 System.Text.Json 反序列化，**不依赖原 Services 层**，避免拉入 200+ cs 的复杂度
/// - 幂等：按 Id upsert（新增或更新），多次执行结果一致
/// - 容错：单个文件解析失败只记 Warning，不中断整体导入
/// - 报告：所有结果汇总写到 import-report.json
/// </summary>
public class DataImportService : IDataImportService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly AppDbContext _db;
    private readonly ILogger<DataImportService> _logger;

    public DataImportService(AppDbContext db, ILogger<DataImportService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<ImportReport> ImportFromAsync(ImportRequest request, CancellationToken ct = default)
    {
        var startedAt = DateTime.UtcNow;
        var summaries = new List<ImportTableSummary>();
        var warnings = new List<string>();
        var errors = new List<string>();

        try
        {
            if (!Directory.Exists(request.SourceStoragePath))
            {
                errors.Add($"源 Storage 目录不存在：{request.SourceStoragePath}");
                return new ImportReport(startedAt, DateTime.UtcNow, request.SourceStoragePath, false, summaries, warnings, errors);
            }

            // 1. 全局共享数据（Modules/Design + Modules/Generate）
            summaries.Add(await ImportBusinessJsonAsync<WorldRule>(request.SourceStoragePath,
                "Modules/Design/GlobalSettings/WorldRules/world_rules.json", ModuleTypes.WorldRules, warnings, ct));
            summaries.Add(await ImportBusinessJsonAsync<CharacterRule>(request.SourceStoragePath,
                "Modules/Design/Elements/CharacterRules/character_rules.json", ModuleTypes.CharacterRules, warnings, ct));
            summaries.Add(await ImportBusinessJsonAsync<FactionRule>(request.SourceStoragePath,
                "Modules/Design/Elements/FactionRules/faction_rules.json", ModuleTypes.FactionRules, warnings, ct));
            summaries.Add(await ImportBusinessJsonAsync<LocationRule>(request.SourceStoragePath,
                "Modules/Design/Elements/LocationRules/location_rules.json", ModuleTypes.LocationRules, warnings, ct));
            summaries.Add(await ImportBusinessJsonAsync<PlotRule>(request.SourceStoragePath,
                "Modules/Design/Elements/PlotRules/plot_rules.json", ModuleTypes.PlotRules, warnings, ct));
            summaries.Add(await ImportBusinessJsonAsync<CreativeMaterial>(request.SourceStoragePath,
                "Modules/Design/Templates/CreativeMaterials/creative_materials.json", ModuleTypes.CreativeMaterials, warnings, ct));
            summaries.Add(await ImportBusinessJsonAsync<BookAnalysis>(request.SourceStoragePath,
                "Modules/Design/SmartParsing/BookAnalysis/book_analysis.json", ModuleTypes.BookAnalyses, warnings, ct));

            summaries.Add(await ImportBusinessJsonAsync<Outline>(request.SourceStoragePath,
                "Modules/Generate/GlobalSettings/Outline/outline_data.json", ModuleTypes.Outlines, warnings, ct));
            summaries.Add(await ImportBusinessJsonAsync<VolumeDesign>(request.SourceStoragePath,
                "Modules/Generate/Elements/VolumeDesign/volume_design_data.json", ModuleTypes.VolumeDesigns, warnings, ct));
            summaries.Add(await ImportBusinessJsonAsync<ChapterPlan>(request.SourceStoragePath,
                "Modules/Generate/Elements/Chapter/chapter_data.json", ModuleTypes.ChapterPlans, warnings, ct));
            summaries.Add(await ImportBusinessJsonAsync<ChapterBlueprint>(request.SourceStoragePath,
                "Modules/Generate/Elements/Blueprint/blueprint_data.json", ModuleTypes.ChapterBlueprints, warnings, ct));

            // 2. 分类（按模块各扫一个 built_in_categories.json）
            summaries.Add(await ImportCategoriesAsync(request.SourceStoragePath,
                "Modules/Design/GlobalSettings/WorldRules/built_in_categories.json", ModuleTypes.WorldRules, warnings, ct));
            summaries.Add(await ImportCategoriesAsync(request.SourceStoragePath,
                "Modules/Design/Elements/CharacterRules/built_in_categories.json", ModuleTypes.CharacterRules, warnings, ct));
            summaries.Add(await ImportCategoriesAsync(request.SourceStoragePath,
                "Modules/Design/Elements/FactionRules/built_in_categories.json", ModuleTypes.FactionRules, warnings, ct));
            summaries.Add(await ImportCategoriesAsync(request.SourceStoragePath,
                "Modules/Design/Elements/LocationRules/built_in_categories.json", ModuleTypes.LocationRules, warnings, ct));
            summaries.Add(await ImportCategoriesAsync(request.SourceStoragePath,
                "Modules/Design/Elements/PlotRules/built_in_categories.json", ModuleTypes.PlotRules, warnings, ct));
            summaries.Add(await ImportCategoriesAsync(request.SourceStoragePath,
                "Modules/Design/Templates/CreativeMaterials/built_in_categories.json", ModuleTypes.CreativeMaterials, warnings, ct));
            summaries.Add(await ImportCategoriesAsync(request.SourceStoragePath,
                "Modules/Design/SmartParsing/BookAnalysis/built_in_categories.json", ModuleTypes.BookAnalyses, warnings, ct));

            // 3. PromptTemplates（散文件 built_in_templates/*.json）
            summaries.Add(await ImportPromptTemplatesAsync(request.SourceStoragePath,
                "Modules/AIAssistant/PromptTools/PromptManagement/built_in_templates", warnings, ct));

            // 4. 项目（Storage/Projects/{name}/manifest.json）
            summaries.Add(await ImportProjectsAsync(request.SourceStoragePath, warnings, ct));

            // 5. 章节正文文件复制（不入库，由 chapters.content_file_path 引用）
            summaries.Add(await CopyChaptersAsync(request.SourceStoragePath, warnings, ct));
            summaries.Add(await ImportProjectConfigAsync(request.SourceStoragePath, warnings, ct));
        }
        catch (Exception ex)
        {
            errors.Add($"导入过程异常：{ex.Message}");
            _logger.LogError(ex, "数据导入失败");
        }

        var finishedAt = DateTime.UtcNow;
        var report = new ImportReport(startedAt, finishedAt, request.SourceStoragePath,
            errors.Count == 0, summaries, warnings, errors);

        await WriteReportAsync(report, ct);
        return report;
    }

    private async Task<ImportTableSummary> ImportBusinessJsonAsync<TEntity>(
        string sourceRoot, string relativePath, string tableName,
        List<string> warnings, CancellationToken ct)
        where TEntity : BusinessDataBase
    {
        var fullPath = Path.Combine(sourceRoot, relativePath);
        if (!File.Exists(fullPath))
        {
            return new ImportTableSummary(tableName, relativePath, 0, 0, 0, 0);
        }

        int inserted = 0, updated = 0, skipped = 0, read = 0;

        try
        {
            await using var stream = File.OpenRead(fullPath);
            var rows = await JsonSerializer.DeserializeAsync<List<TEntity>>(stream, JsonOptions, ct);
            if (rows == null) return new ImportTableSummary(tableName, relativePath, 0, 0, 0, 0);
            read = rows.Count;

            foreach (var row in rows)
            {
                if (string.IsNullOrWhiteSpace(row.Id))
                {
                    skipped++;
                    continue;
                }

                var existing = await _db.Set<TEntity>().FindAsync(new object?[] { row.Id }, ct);
                if (existing == null)
                {
                    _db.Set<TEntity>().Add(row);
                    inserted++;
                }
                else
                {
                    _db.Entry(existing).CurrentValues.SetValues(row);
                    updated++;
                }
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            warnings.Add($"解析 {relativePath} 失败：{ex.Message}");
            _logger.LogWarning(ex, "导入 {File} 失败", relativePath);
        }

        return new ImportTableSummary(tableName, relativePath, read, inserted, updated, skipped);
    }

    private async Task<ImportTableSummary> ImportCategoriesAsync(
        string sourceRoot, string relativePath, string moduleType,
        List<string> warnings, CancellationToken ct)
    {
        var fullPath = Path.Combine(sourceRoot, relativePath);
        if (!File.Exists(fullPath))
        {
            return new ImportTableSummary("categories", relativePath, 0, 0, 0, 0);
        }

        int inserted = 0, updated = 0, skipped = 0, read = 0;

        try
        {
            await using var stream = File.OpenRead(fullPath);
            var rows = await JsonSerializer.DeserializeAsync<List<LegacyCategoryDto>>(stream, JsonOptions, ct);
            if (rows == null) return new ImportTableSummary("categories", relativePath, 0, 0, 0, 0);
            read = rows.Count;

            foreach (var src in rows)
            {
                if (string.IsNullOrWhiteSpace(src.Id))
                {
                    skipped++;
                    continue;
                }

                var existing = await _db.Categories.FindAsync(new object?[] { src.Id }, ct);
                if (existing == null)
                {
                    _db.Categories.Add(new Category
                    {
                        Id = src.Id,
                        ModuleType = moduleType,
                        Name = src.Name,
                        ParentId = src.ParentCategory,
                        SortOrder = src.Order,
                        IsBuiltIn = src.IsBuiltIn,
                        IsEnabled = src.IsEnabled,
                    });
                    inserted++;
                }
                else
                {
                    existing.ModuleType = moduleType;
                    existing.Name = src.Name;
                    existing.ParentId = src.ParentCategory;
                    existing.SortOrder = src.Order;
                    existing.IsBuiltIn = src.IsBuiltIn;
                    existing.IsEnabled = src.IsEnabled;
                    updated++;
                }
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            warnings.Add($"解析 {relativePath} 失败：{ex.Message}");
        }

        return new ImportTableSummary("categories", relativePath, read, inserted, updated, skipped);
    }

    private async Task<ImportTableSummary> ImportPromptTemplatesAsync(
        string sourceRoot, string relativeDir, List<string> warnings, CancellationToken ct)
    {
        var fullDir = Path.Combine(sourceRoot, relativeDir);
        if (!Directory.Exists(fullDir))
        {
            return new ImportTableSummary("prompt_templates", relativeDir, 0, 0, 0, 0);
        }

        int inserted = 0, updated = 0, skipped = 0, read = 0;

        foreach (var file in Directory.GetFiles(fullDir, "*.json"))
        {
            try
            {
                await using var stream = File.OpenRead(file);
                var rows = await JsonSerializer.DeserializeAsync<List<LegacyPromptTemplateDto>>(stream, JsonOptions, ct);
                if (rows == null) continue;
                read += rows.Count;

                foreach (var src in rows)
                {
                    if (string.IsNullOrWhiteSpace(src.Id))
                    {
                        skipped++;
                        continue;
                    }

                    var existing = await _db.PromptTemplates.FindAsync(new object?[] { src.Id }, ct);
                    if (existing == null)
                    {
                        _db.PromptTemplates.Add(new PromptTemplate
                        {
                            Id = src.Id,
                            Code = src.Id,
                            Name = src.Name,
                            Category = src.Category ?? string.Empty,
                            Content = src.SystemPrompt ?? string.Empty,
                            Description = src.Description,
                            Variables = JsonSerializer.Serialize((src.Variables ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)),
                            IsBuiltIn = src.IsBuiltIn,
                            IsEnabled = src.IsEnabled,
                        });
                        inserted++;
                    }
                    else
                    {
                        existing.Name = src.Name;
                        existing.Category = src.Category ?? string.Empty;
                        existing.Content = src.SystemPrompt ?? string.Empty;
                        existing.Description = src.Description;
                        existing.IsBuiltIn = src.IsBuiltIn;
                        existing.IsEnabled = src.IsEnabled;
                        updated++;
                    }
                }
            }
            catch (Exception ex)
            {
                warnings.Add($"解析 {file} 失败：{ex.Message}");
            }
        }

        await _db.SaveChangesAsync(ct);
        return new ImportTableSummary("prompt_templates", relativeDir, read, inserted, updated, skipped);
    }

    private async Task<ImportTableSummary> ImportProjectsAsync(
        string sourceRoot, List<string> warnings, CancellationToken ct)
    {
        var projectsDir = Path.Combine(sourceRoot, "Projects");
        if (!Directory.Exists(projectsDir))
        {
            return new ImportTableSummary("projects", "Projects/", 0, 0, 0, 0);
        }

        int inserted = 0, updated = 0, read = 0;

        foreach (var dir in Directory.GetDirectories(projectsDir))
        {
            var projectName = Path.GetFileName(dir);
            if (string.IsNullOrWhiteSpace(projectName)) continue;
            read++;

            var manifestPath = Path.Combine(dir, "manifest.json");
            string? manifestVersionRaw = null;
            if (File.Exists(manifestPath))
            {
                try
                {
                    using var doc = JsonDocument.Parse(await File.ReadAllTextAsync(manifestPath, ct));
                    if (doc.RootElement.TryGetProperty("Version", out var v) && v.ValueKind != JsonValueKind.Null)
                        manifestVersionRaw = v.ToString();
                }
                catch (Exception ex)
                {
                    warnings.Add($"解析项目 manifest.json 失败（{projectName}）：{ex.Message}");
                }
            }

            int version = int.TryParse(manifestVersionRaw, out var vNum) ? vNum : 0;

            var existing = await _db.Projects.FirstOrDefaultAsync(p => p.Name == projectName, ct);
            if (existing == null)
            {
                _db.Projects.Add(new Project
                {
                    Name = projectName,
                    Version = version,
                    LastModifiedAt = Directory.GetLastWriteTimeUtc(dir),
                });
                inserted++;
            }
            else
            {
                existing.Version = version;
                existing.LastModifiedAt = Directory.GetLastWriteTimeUtc(dir);
                updated++;
            }
        }

        await _db.SaveChangesAsync(ct);
        return new ImportTableSummary("projects", "Projects/", read, inserted, updated, 0);
    }

    private Task<ImportTableSummary> CopyChaptersAsync(
        string sourceRoot, List<string> warnings, CancellationToken ct)
    {
        var projectsDir = Path.Combine(sourceRoot, "Projects");
        if (!Directory.Exists(projectsDir))
            return Task.FromResult(new ImportTableSummary("chapters_md", "Projects/*/Generated/chapters/", 0, 0, 0, 0));

        int copied = 0;
        foreach (var projDir in Directory.GetDirectories(projectsDir))
        {
            var srcChapDir = Path.Combine(projDir, "Generated", "chapters");
            if (!Directory.Exists(srcChapDir)) continue;

            var projectName = Path.GetFileName(projDir);
            var targetDir = Path.Combine(ResolveStorageRoot(), "projects", SanitizeFileName(projectName), "chapters");
            Directory.CreateDirectory(targetDir);

            foreach (var mdFile in Directory.GetFiles(srcChapDir, "*.md"))
            {
                var dest = Path.Combine(targetDir, Path.GetFileName(mdFile));
                try
                {
                    File.Copy(mdFile, dest, overwrite: true);
                    copied++;
                }
                catch (Exception ex)
                {
                    warnings.Add($"复制章节失败 {mdFile}：{ex.Message}");
                }
            }
        }

        return Task.FromResult(new ImportTableSummary("chapters_md", "Projects/*/Generated/chapters/", copied, copied, 0, 0));
    }

    private async Task<ImportTableSummary> ImportProjectConfigAsync(
        string sourceRoot, List<string> warnings, CancellationToken ct)
    {
        var projectsDir = Path.Combine(sourceRoot, "Projects");
        if (!Directory.Exists(projectsDir))
            return new ImportTableSummary("project_config", "Projects/*/Config/**", 0, 0, 0, 0);

        int read = 0, inserted = 0, updated = 0, skipped = 0;

        foreach (var projDir in Directory.GetDirectories(projectsDir))
        {
            var projectName = Path.GetFileName(projDir);
            if (string.IsNullOrWhiteSpace(projectName))
                continue;

            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Name == projectName, ct);
            if (project == null)
            {
                warnings.Add($"项目配置导入跳过：数据库中找不到项目 {projectName}");
                continue;
            }

            var configDir = Path.Combine(projDir, "Config");
            if (!Directory.Exists(configDir))
                continue;

            read++;
            inserted += await UpsertSingleFileEntityAsync(
                project.Id, "work_scope",
                Path.Combine(configDir, "work_scope.json"),
                async json => await UpsertWorkScopeAsync(project.Id, json, ct),
                warnings, ct);

            inserted += await UpsertSingleFileEntityAsync(
                project.Id, "generation_statistics",
                Path.Combine(configDir, "generation_statistics.json"),
                async json => await UpsertGenerationStatisticsAsync(project.Id, json, ct),
                warnings, ct);

            inserted += await UpsertSingleFileEntityAsync(
                project.Id, "global_summary",
                Path.Combine(configDir, "global_summary.json"),
                async json => await UpsertGlobalSummaryAsync(project.Id, json, ct),
                warnings, ct);

            inserted += await UpsertSingleFileEntityAsync(
                project.Id, "layer_completion_status",
                Path.Combine(configDir, "layer_completion_status.json"),
                async json => await UpsertLayerCompletionStatusAsync(project.Id, json, ct),
                warnings, ct);

            inserted += await ImportProjectGuidesAsync(project.Id, Path.Combine(configDir, "guides"), warnings, ct);
        }

        await _db.SaveChangesAsync(ct);
        return new ImportTableSummary("project_config", "Projects/*/Config/**", read, inserted, updated, skipped);
    }

    private async Task<int> UpsertSingleFileEntityAsync(
        string projectId,
        string tableName,
        string filePath,
        Func<string, Task<int>> handleJson,
        List<string> warnings,
        CancellationToken ct)
    {
        if (!File.Exists(filePath))
            return 0;
        try
        {
            var json = await File.ReadAllTextAsync(filePath, ct);
            return await handleJson(json);
        }
        catch (Exception ex)
        {
            warnings.Add($"解析 {tableName} 失败：{ex.Message}");
            return 0;
        }
    }

    private async Task<int> UpsertWorkScopeAsync(string projectId, string json, CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(json);
        var sourceBookId = ReadString(doc.RootElement, "CurrentSourceBookId", "currentSourceBookId", "SourceBookId");
        var project = await _db.Projects.FirstOrDefaultAsync(x => x.Id == projectId, ct);
        if (project != null)
            project.CurrentSourceBookId = sourceBookId;

        var existing = await _db.WorkScopes.FirstOrDefaultAsync(x => x.ProjectId == projectId, ct);
        if (existing == null)
        {
            _db.WorkScopes.Add(new TM.Web.Domain.Entities.Metadata.WorkScope
            {
                ProjectId = projectId,
                CurrentSourceBookId = sourceBookId
            });
            return 1;
        }

        existing.CurrentSourceBookId = sourceBookId;
        return 1;
    }

    private async Task<int> UpsertGenerationStatisticsAsync(string projectId, string json, CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(json);
        var existing = await _db.GenerationStatistics.FirstOrDefaultAsync(x => x.ProjectId == projectId, ct);
        if (existing == null)
        {
            existing = new TM.Web.Domain.Entities.Runtime.GenerationStatistics { ProjectId = projectId };
            _db.GenerationStatistics.Add(existing);
        }

        existing.TotalGenerations = ReadInt(doc.RootElement, "TotalGenerations", "totalGenerations");
        existing.FirstPassCount = ReadInt(doc.RootElement, "FirstPassCount", "firstPassCount");
        existing.RewriteCount = ReadInt(doc.RootElement, "RewritePassCount", "RewriteCount", "rewriteCount");
        existing.FailureCount = ReadInt(doc.RootElement, "FinalFailureCount", "FailureCount", "failureCount");
        existing.TotalInputTokens = ReadLong(doc.RootElement, "TotalInputTokens", "totalInputTokens");
        existing.TotalOutputTokens = ReadLong(doc.RootElement, "TotalOutputTokens", "totalOutputTokens");
        existing.TotalCostMicros = ReadLong(doc.RootElement, "TotalCostMicros", "totalCostMicros");
        existing.LastUpdatedAt = ReadDate(doc.RootElement, "EndTime", "LastUpdatedAt", "lastUpdatedAt") ?? DateTime.UtcNow;
        return 1;
    }

    private async Task<int> UpsertGlobalSummaryAsync(string projectId, string json, CancellationToken ct)
    {
        var existing = await _db.GlobalSummaryCaches.FirstOrDefaultAsync(x => x.ProjectId == projectId, ct);
        if (existing == null)
        {
            existing = new TM.Web.Domain.Entities.Indexing.GlobalSummaryCache { ProjectId = projectId };
            _db.GlobalSummaryCaches.Add(existing);
        }

        existing.Payload = json;
        existing.ComputedAt = DateTime.UtcNow;
        return 1;
    }

    private async Task<int> UpsertLayerCompletionStatusAsync(string projectId, string json, CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(json);
        if (TryGet(doc.RootElement, "Layers", out var layers) && layers.ValueKind == JsonValueKind.Object)
        {
            var count = 0;
            foreach (var layer in layers.EnumerateObject())
            {
                await UpsertLayerStatusAsync(projectId, layer.Name, layer.Value, ct);
                count++;
            }
            return count;
        }

        await UpsertLayerStatusAsync(projectId, "all", doc.RootElement, ct);
        return 1;
    }

    private async Task UpsertLayerStatusAsync(string projectId, string layer, JsonElement payload, CancellationToken ct)
    {
        var existing = await _db.LayerCompletionStatuses.FirstOrDefaultAsync(x => x.ProjectId == projectId && x.Layer == layer, ct);
        if (existing == null)
        {
            existing = new LayerCompletionStatus { ProjectId = projectId, Layer = layer };
            _db.LayerCompletionStatuses.Add(existing);
        }

        existing.IsCompleted = ReadBool(payload, "IsCompleted", "isCompleted");
        existing.CompletedAt = ReadDate(payload, "CompletedAt", "completedAt");
        existing.DataVersion = ReadInt(payload, "DataVersion", "dataVersion");
        existing.SummaryVersion = ReadInt(payload, "SummaryVersion", "summaryVersion");
    }

    private async Task<int> ImportProjectGuidesAsync(string projectId, string guidesDir, List<string> warnings, CancellationToken ct)
    {
        if (!Directory.Exists(guidesDir))
            return 0;

        var count = 0;
        count += await ImportCharacterStateGuidesAsync(projectId, guidesDir, warnings, ct);
        count += await ImportConflictProgressGuidesAsync(projectId, guidesDir, warnings, ct);
        count += await ImportForeshadowingGuideAsync(projectId, Path.Combine(guidesDir, "foreshadowing_status_guide.json"), warnings, ct);
        count += await ImportLocationStateGuidesAsync(projectId, guidesDir, warnings, ct);
        count += await ImportFactionStateGuidesAsync(projectId, guidesDir, warnings, ct);
        count += await ImportItemStateGuidesAsync(projectId, guidesDir, warnings, ct);
        count += await ImportTimelineGuidesAsync(projectId, guidesDir, warnings, ct);
        count += await ImportPlotPointsAsync(projectId, Path.Combine(guidesDir, "plot_points"), warnings, ct);
        count += await ImportKeywordIndexAsync(projectId, Path.Combine(guidesDir, "keyword_index.json"), warnings, ct);
        count += await ImportRelationStrengthIndexAsync(projectId, Path.Combine(guidesDir, "relation_strength_index.json"), warnings, ct);
        count += await ImportFactArchivesAsync(projectId, Path.Combine(guidesDir, "fact_archives"), warnings, ct);
        count += await ImportMilestonesAsync(projectId, Path.Combine(guidesDir, "milestones"), warnings, ct);
        count += await ImportValidationSummariesAsync(projectId, warnings, ct);
        count += await ImportValidationReportsAsync(projectId, warnings, ct);
        return count;
    }

    private async Task<int> ImportCharacterStateGuidesAsync(string projectId, string guidesDir, List<string> warnings, CancellationToken ct)
    {
        var count = 0;
        foreach (var file in Directory.GetFiles(guidesDir, "character_state_guide_vol*.json"))
        {
            try
            {
                var json = await File.ReadAllTextAsync(file, ct);
                using var doc = JsonDocument.Parse(json);
                var sourceBookId = ReadString(doc.RootElement, "SourceBookId");
                if (!TryGet(doc.RootElement, "Characters", out var chars) || chars.ValueKind != JsonValueKind.Object)
                    continue;

                await _db.CharacterStateEntries.Where(x => x.ProjectId == projectId && x.SourceBookId == sourceBookId).ExecuteDeleteAsync(ct);
                foreach (var ch in chars.EnumerateObject())
                {
                    var entryId = StableId(projectId, "char", ch.Name);
                    var entry = new CharacterStateEntry
                    {
                        Id = entryId,
                        ProjectId = projectId,
                        SourceBookId = sourceBookId,
                        CharacterId = ch.Name,
                        Name = ReadString(ch.Value, "Name") ?? ch.Name,
                        BaseProfile = ReadString(ch.Value, "BaseProfile") ?? string.Empty,
                        DriftWarnings = ReadStringArray(ch.Value, "DriftWarnings")
                    };
                    _db.CharacterStateEntries.Add(entry);
                    count++;

                    if (TryGet(ch.Value, "StateHistory", out var history) && history.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var point in history.EnumerateArray())
                        {
                            var chapterId = ReadString(point, "Chapter", "ChapterId") ?? string.Empty;
                            _db.CharacterStatePoints.Add(new CharacterStatePoint
                            {
                                Id = StableId(entryId, "point", chapterId, ReadString(point, "KeyEvent") ?? string.Empty),
                                CharacterStateEntryId = entryId,
                                ChapterId = chapterId,
                                Phase = ReadString(point, "Phase") ?? string.Empty,
                                Level = ReadString(point, "Level") ?? string.Empty,
                                Abilities = ReadStringArray(point, "Abilities"),
                                MentalState = ReadString(point, "MentalState") ?? string.Empty,
                                KeyEvent = ReadString(point, "KeyEvent") ?? string.Empty,
                                Importance = ReadString(point, "Importance") ?? "normal"
                            });

                            if (TryGet(point, "Relationships", out var rels) && rels.ValueKind == JsonValueKind.Object)
                            {
                                foreach (var rel in rels.EnumerateObject())
                                {
                                    _db.CharacterRelationshipStates.Add(new CharacterRelationshipState
                                    {
                                        Id = StableId(entryId, "rel", rel.Name, chapterId),
                                        CharacterStateEntryId = entryId,
                                        TargetCharacterName = rel.Name,
                                        ChapterId = chapterId,
                                        Relation = ReadString(rel.Value, "Relation") ?? string.Empty,
                                        Trust = ReadInt(rel.Value, "Trust")
                                    });
                                }
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                warnings.Add($"导入角色状态 guide 失败 {file}：{ex.Message}");
            }
        }

        return count;
    }

    private async Task<int> ImportConflictProgressGuidesAsync(string projectId, string guidesDir, List<string> warnings, CancellationToken ct)
    {
        var count = 0;
        foreach (var file in Directory.GetFiles(guidesDir, "conflict_progress_guide_vol*.json"))
        {
            try
            {
                var json = await File.ReadAllTextAsync(file, ct);
                using var doc = JsonDocument.Parse(json);
                var sourceBookId = ReadString(doc.RootElement, "SourceBookId");
                if (!TryGet(doc.RootElement, "Conflicts", out var conflicts) || conflicts.ValueKind != JsonValueKind.Object)
                    continue;

                foreach (var conflict in conflicts.EnumerateObject())
                {
                    var entryId = StableId(projectId, "conflict", conflict.Name);
                    var existing = await _db.ConflictProgressEntries.FirstOrDefaultAsync(x => x.Id == entryId, ct);
                    if (existing == null)
                    {
                        existing = new ConflictProgressEntry { Id = entryId, ProjectId = projectId };
                        _db.ConflictProgressEntries.Add(existing);
                        count++;
                    }

                    existing.SourceBookId = sourceBookId;
                    existing.Name = ReadString(conflict.Value, "Name") ?? conflict.Name;
                    existing.Type = ReadString(conflict.Value, "Type") ?? string.Empty;
                    existing.Tier = ReadString(conflict.Value, "Tier") ?? "Tier-3";
                    existing.Status = ReadString(conflict.Value, "Status") ?? "pending";
                    existing.InvolvedChapters = ReadStringArray(conflict.Value, "InvolvedChapters");
                    existing.InvolvedCharacters = ReadStringArray(conflict.Value, "InvolvedCharacters");

                    if (TryGet(conflict.Value, "ProgressPoints", out var points) && points.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var point in points.EnumerateArray())
                        {
                            var chapterId = ReadString(point, "Chapter", "ChapterId") ?? string.Empty;
                            _db.ConflictProgressPoints.Add(new ConflictProgressPoint
                            {
                                Id = StableId(entryId, "point", chapterId, ReadString(point, "Event") ?? string.Empty),
                                ConflictProgressEntryId = entryId,
                                ChapterId = chapterId,
                                Event = ReadString(point, "Event") ?? string.Empty,
                                Status = ReadString(point, "Status") ?? string.Empty,
                                Description = ReadString(point, "Description") ?? string.Empty,
                                Importance = ReadString(point, "Importance") ?? "normal"
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                warnings.Add($"导入冲突进度 guide 失败 {file}：{ex.Message}");
            }
        }

        return count;
    }

    private async Task<int> ImportForeshadowingGuideAsync(string projectId, string filePath, List<string> warnings, CancellationToken ct)
    {
        if (!File.Exists(filePath))
            return 0;

        try
        {
            var json = await File.ReadAllTextAsync(filePath, ct);
            using var doc = JsonDocument.Parse(json);
            var sourceBookId = ReadString(doc.RootElement, "SourceBookId");
            if (!TryGet(doc.RootElement, "Foreshadowings", out var items) || items.ValueKind != JsonValueKind.Object)
                return 0;

            await _db.Foreshadowings.Where(x => x.ProjectId == projectId && x.SourceBookId == sourceBookId).ExecuteDeleteAsync(ct);
            var count = 0;
            foreach (var item in items.EnumerateObject())
            {
                _db.Foreshadowings.Add(new Foreshadowing
                {
                    Id = StableId(projectId, "foreshadow", item.Name),
                    ProjectId = projectId,
                    SourceBookId = sourceBookId,
                    Name = ReadString(item.Value, "Name") ?? item.Name,
                    Tier = ReadString(item.Value, "Tier") ?? "Tier-3",
                    IsSetup = ReadBool(item.Value, "IsSetup"),
                    IsResolved = ReadBool(item.Value, "IsResolved"),
                    IsOverdue = ReadBool(item.Value, "IsOverdue"),
                    ExpectedSetupChapter = ReadString(item.Value, "ExpectedSetupChapter") ?? string.Empty,
                    ExpectedPayoffChapter = ReadString(item.Value, "ExpectedPayoffChapter") ?? string.Empty,
                    ActualSetupChapter = ReadString(item.Value, "ActualSetupChapter") ?? string.Empty,
                    ActualPayoffChapter = ReadString(item.Value, "ActualPayoffChapter") ?? string.Empty
                });
                count++;
            }

            return count;
        }
        catch (Exception ex)
        {
            warnings.Add($"导入伏笔 guide 失败 {filePath}：{ex.Message}");
            return 0;
        }
    }

    private async Task<int> ImportLocationStateGuidesAsync(string projectId, string guidesDir, List<string> warnings, CancellationToken ct)
    {
        var count = 0;
        foreach (var file in Directory.GetFiles(guidesDir, "location_state_guide*.json"))
        {
            try
            {
                var json = await File.ReadAllTextAsync(file, ct);
                using var doc = JsonDocument.Parse(json);
                var sourceBookId = ReadString(doc.RootElement, "SourceBookId");
                if (!TryGet(doc.RootElement, "Locations", out var locations) || locations.ValueKind != JsonValueKind.Object)
                    continue;

                foreach (var loc in locations.EnumerateObject())
                {
                    var entryId = StableId(projectId, "location", loc.Name);
                    var entry = await _db.LocationStateEntries.FirstOrDefaultAsync(x => x.Id == entryId, ct);
                    if (entry == null)
                    {
                        entry = new LocationStateEntry { Id = entryId, ProjectId = projectId };
                        _db.LocationStateEntries.Add(entry);
                        count++;
                    }

                    entry.SourceBookId = sourceBookId;
                    entry.LocationId = loc.Name;
                    entry.Name = ReadString(loc.Value, "Name") ?? loc.Name;
                    entry.CurrentStatus = ReadString(loc.Value, "CurrentStatus") ?? "normal";

                    if (TryGet(loc.Value, "StateHistory", out var history) && history.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var point in history.EnumerateArray())
                        {
                            _db.LocationStatePoints.Add(new LocationStatePoint
                            {
                                Id = StableId(entryId, "point", ReadString(point, "Chapter") ?? string.Empty, ReadString(point, "Event") ?? string.Empty),
                                LocationStateEntryId = entryId,
                                ChapterId = ReadString(point, "Chapter") ?? string.Empty,
                                Status = ReadString(point, "Status") ?? string.Empty,
                                Event = ReadString(point, "Event") ?? string.Empty,
                                Importance = ReadString(point, "Importance") ?? "normal"
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                warnings.Add($"导入地点状态 guide 失败 {file}：{ex.Message}");
            }
        }
        return count;
    }

    private async Task<int> ImportFactionStateGuidesAsync(string projectId, string guidesDir, List<string> warnings, CancellationToken ct)
    {
        var count = 0;
        foreach (var file in Directory.GetFiles(guidesDir, "faction_state_guide*.json"))
        {
            try
            {
                var json = await File.ReadAllTextAsync(file, ct);
                using var doc = JsonDocument.Parse(json);
                var sourceBookId = ReadString(doc.RootElement, "SourceBookId");
                if (!TryGet(doc.RootElement, "Factions", out var factions) || factions.ValueKind != JsonValueKind.Object)
                    continue;

                foreach (var fac in factions.EnumerateObject())
                {
                    var entryId = StableId(projectId, "faction", fac.Name);
                    var entry = await _db.FactionStateEntries.FirstOrDefaultAsync(x => x.Id == entryId, ct);
                    if (entry == null)
                    {
                        entry = new FactionStateEntry { Id = entryId, ProjectId = projectId };
                        _db.FactionStateEntries.Add(entry);
                        count++;
                    }

                    entry.SourceBookId = sourceBookId;
                    entry.FactionId = fac.Name;
                    entry.Name = ReadString(fac.Value, "Name") ?? fac.Name;
                    entry.CurrentStatus = ReadString(fac.Value, "CurrentStatus") ?? "active";

                    if (TryGet(fac.Value, "StateHistory", out var history) && history.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var point in history.EnumerateArray())
                        {
                            _db.FactionStatePoints.Add(new FactionStatePoint
                            {
                                Id = StableId(entryId, "point", ReadString(point, "Chapter") ?? string.Empty, ReadString(point, "Event") ?? string.Empty),
                                FactionStateEntryId = entryId,
                                ChapterId = ReadString(point, "Chapter") ?? string.Empty,
                                Status = ReadString(point, "Status") ?? string.Empty,
                                Event = ReadString(point, "Event") ?? string.Empty,
                                Importance = ReadString(point, "Importance") ?? "normal"
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                warnings.Add($"导入势力状态 guide 失败 {file}：{ex.Message}");
            }
        }
        return count;
    }

    private async Task<int> ImportItemStateGuidesAsync(string projectId, string guidesDir, List<string> warnings, CancellationToken ct)
    {
        var count = 0;
        foreach (var file in Directory.GetFiles(guidesDir, "item_state_guide*.json"))
        {
            try
            {
                var json = await File.ReadAllTextAsync(file, ct);
                using var doc = JsonDocument.Parse(json);
                var sourceBookId = ReadString(doc.RootElement, "SourceBookId");
                if (!TryGet(doc.RootElement, "Items", out var items) || items.ValueKind != JsonValueKind.Object)
                    continue;

                foreach (var item in items.EnumerateObject())
                {
                    var entryId = StableId(projectId, "item", item.Name);
                    var entry = await _db.ItemStateEntries.FirstOrDefaultAsync(x => x.Id == entryId, ct);
                    if (entry == null)
                    {
                        entry = new ItemStateEntry { Id = entryId, ProjectId = projectId };
                        _db.ItemStateEntries.Add(entry);
                        count++;
                    }

                    entry.SourceBookId = sourceBookId;
                    entry.Name = ReadString(item.Value, "Name") ?? item.Name;
                    entry.Description = ReadString(item.Value, "Description") ?? string.Empty;
                    entry.CurrentHolder = ReadString(item.Value, "CurrentHolder") ?? string.Empty;
                    entry.CurrentStatus = ReadString(item.Value, "CurrentStatus") ?? "active";

                    if (TryGet(item.Value, "StateHistory", out var history) && history.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var point in history.EnumerateArray())
                        {
                            _db.ItemStatePoints.Add(new ItemStatePoint
                            {
                                Id = StableId(entryId, "point", ReadString(point, "Chapter") ?? string.Empty, ReadString(point, "Event") ?? string.Empty),
                                ItemStateEntryId = entryId,
                                ChapterId = ReadString(point, "Chapter") ?? string.Empty,
                                Holder = ReadString(point, "Holder") ?? string.Empty,
                                Status = ReadString(point, "Status") ?? "active",
                                Event = ReadString(point, "Event") ?? string.Empty,
                                Importance = ReadString(point, "Importance") ?? "normal"
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                warnings.Add($"导入物品状态 guide 失败 {file}：{ex.Message}");
            }
        }
        return count;
    }

    private async Task<int> ImportTimelineGuidesAsync(string projectId, string guidesDir, List<string> warnings, CancellationToken ct)
    {
        var count = 0;
        foreach (var file in Directory.GetFiles(guidesDir, "timeline_guide*.json"))
        {
            try
            {
                var json = await File.ReadAllTextAsync(file, ct);
                using var doc = JsonDocument.Parse(json);
                var sourceBookId = ReadString(doc.RootElement, "SourceBookId");

                if (TryGet(doc.RootElement, "ChapterTimeline", out var timeline) && timeline.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in timeline.EnumerateArray())
                    {
                        _db.ChapterTimelines.Add(new ChapterTimeline
                        {
                            Id = StableId(projectId, "timeline", ReadString(item, "ChapterId") ?? string.Empty),
                            ProjectId = projectId,
                            SourceBookId = sourceBookId,
                            ChapterId = ReadString(item, "ChapterId") ?? string.Empty,
                            TimePeriod = ReadString(item, "TimePeriod") ?? string.Empty,
                            ElapsedTime = ReadString(item, "ElapsedTime") ?? string.Empty,
                            KeyTimeEvent = ReadString(item, "KeyTimeEvent") ?? string.Empty,
                            Importance = ReadString(item, "Importance") ?? "normal"
                        });
                        count++;
                    }
                }

                if (TryGet(doc.RootElement, "CharacterLocations", out var locations) && locations.ValueKind == JsonValueKind.Object)
                {
                    foreach (var loc in locations.EnumerateObject())
                    {
                        var entryId = StableId(projectId, "charloc", loc.Name);
                        var entry = await _db.CharacterLocations.FirstOrDefaultAsync(x => x.Id == entryId, ct);
                        if (entry == null)
                        {
                            entry = new CharacterLocation { Id = entryId, ProjectId = projectId };
                            _db.CharacterLocations.Add(entry);
                            count++;
                        }
                        entry.SourceBookId = sourceBookId;
                        entry.CharacterName = ReadString(loc.Value, "CharacterName") ?? loc.Name;
                        entry.CurrentLocation = ReadString(loc.Value, "CurrentLocation") ?? string.Empty;
                        entry.LastUpdatedChapter = ReadString(loc.Value, "LastUpdatedChapter") ?? string.Empty;

                        if (TryGet(loc.Value, "MovementHistory", out var moves) && moves.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var move in moves.EnumerateArray())
                            {
                                _db.CharacterMovements.Add(new CharacterMovement
                                {
                                    Id = StableId(entryId, "move", ReadString(move, "Chapter") ?? string.Empty, ReadString(move, "ToLocation") ?? string.Empty),
                                    ProjectId = projectId,
                                    SourceBookId = sourceBookId,
                                    CharacterName = entry.CharacterName,
                                    ChapterId = ReadString(move, "Chapter") ?? string.Empty,
                                    FromLocation = ReadString(move, "FromLocation") ?? string.Empty,
                                    ToLocation = ReadString(move, "ToLocation") ?? string.Empty,
                                    Importance = ReadString(move, "Importance") ?? "normal"
                                });
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                warnings.Add($"导入时间线 guide 失败 {file}：{ex.Message}");
            }
        }
        return count;
    }

    private async Task<int> ImportPlotPointsAsync(string projectId, string dir, List<string> warnings, CancellationToken ct)
    {
        if (!Directory.Exists(dir))
            return 0;

        var count = 0;
        foreach (var file in Directory.GetFiles(dir, "*.json"))
        {
            try
            {
                var json = await File.ReadAllTextAsync(file, ct);
                using var doc = JsonDocument.Parse(json);
                var sourceBookId = ReadString(doc.RootElement, "SourceBookId");
                if (TryGet(doc.RootElement, "PlotPoints", out var points) && points.ValueKind == JsonValueKind.Array)
                {
                    foreach (var p in points.EnumerateArray())
                    {
                        _db.PlotPoints.Add(new PlotPoint
                        {
                            Id = StableId(projectId, "plot", ReadString(p, "Chapter") ?? string.Empty, ReadString(p, "Context") ?? string.Empty),
                            ProjectId = projectId,
                            SourceBookId = sourceBookId,
                            ChapterId = ReadString(p, "Chapter") ?? string.Empty,
                            Context = ReadString(p, "Context") ?? string.Empty,
                            Keywords = ReadStringArray(p, "Keywords"),
                            InvolvedCharacters = ReadStringArray(p, "InvolvedCharacters"),
                            Importance = ReadString(p, "Importance") ?? "normal",
                            Storyline = ReadString(p, "Storyline") ?? "main"
                        });
                        count++;
                    }
                }
            }
            catch (Exception ex)
            {
                warnings.Add($"导入剧情点失败 {file}：{ex.Message}");
            }
        }
        return count;
    }

    private async Task<int> ImportKeywordIndexAsync(string projectId, string filePath, List<string> warnings, CancellationToken ct)
    {
        if (!File.Exists(filePath))
            return 0;

        try
        {
            var json = await File.ReadAllTextAsync(filePath, ct);
            using var doc = JsonDocument.Parse(json);
            await _db.KeywordChapterIndices.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);

            var count = 0;
            if (doc.RootElement.ValueKind == JsonValueKind.Object)
            {
                foreach (var keyword in doc.RootElement.EnumerateObject())
                {
                    if (keyword.Value.ValueKind != JsonValueKind.Array)
                        continue;

                    foreach (var chapter in keyword.Value.EnumerateArray())
                    {
                        var chapterId = chapter.ValueKind == JsonValueKind.String ? chapter.GetString() : null;
                        if (string.IsNullOrWhiteSpace(chapterId))
                            continue;

                        _db.KeywordChapterIndices.Add(new KeywordChapterIndex
                        {
                            Id = StableId(projectId, "kw", keyword.Name, chapterId),
                            ProjectId = projectId,
                            Keyword = keyword.Name,
                            ChapterId = chapterId,
                            OccurrenceCount = 1
                        });
                        count++;
                    }
                }
            }

            return count;
        }
        catch (Exception ex)
        {
            warnings.Add($"导入 keyword_index.json 失败：{ex.Message}");
            return 0;
        }
    }

    private async Task<int> ImportRelationStrengthIndexAsync(string projectId, string filePath, List<string> warnings, CancellationToken ct)
    {
        if (!File.Exists(filePath))
            return 0;

        try
        {
            var json = await File.ReadAllTextAsync(filePath, ct);
            using var doc = JsonDocument.Parse(json);
            await _db.RelationStrengthIndices.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);

            if (!TryGet(doc.RootElement, "Pairs", out var pairs) || pairs.ValueKind != JsonValueKind.Object)
                return 0;

            var count = 0;
            foreach (var pair in pairs.EnumerateObject())
            {
                var parts = pair.Name.Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (parts.Length != 2)
                    parts = pair.Name.Split(':', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (parts.Length != 2)
                    continue;

                var sorted = parts.OrderBy(x => x, StringComparer.Ordinal).ToArray();
                _db.RelationStrengthIndices.Add(new RelationStrengthIndex
                {
                    Id = StableId(projectId, "rel", sorted[0], sorted[1]),
                    ProjectId = projectId,
                    EntityId1 = sorted[0],
                    EntityId2 = sorted[1],
                    Strength = ReadStrength(pair.Value)
                });
                count++;
            }
            return count;
        }
        catch (Exception ex)
        {
            warnings.Add($"导入 relation_strength_index.json 失败：{ex.Message}");
            return 0;
        }
    }

    private async Task<int> ImportFactArchivesAsync(string projectId, string archivesDir, List<string> warnings, CancellationToken ct)
    {
        if (!Directory.Exists(archivesDir))
            return 0;

        var count = 0;
        foreach (var file in Directory.GetFiles(archivesDir, "*.json"))
        {
            try
            {
                var json = await File.ReadAllTextAsync(file, ct);
                using var doc = JsonDocument.Parse(json);
                var volumeNumber = ReadInt(doc.RootElement, "VolumeNumber", "volumeNumber");
                if (volumeNumber <= 0)
                {
                    var name = Path.GetFileNameWithoutExtension(file).Replace("vol", "", StringComparison.OrdinalIgnoreCase);
                    _ = int.TryParse(name, out volumeNumber);
                }
                if (volumeNumber <= 0)
                    continue;

                var archive = await _db.VolumeFactArchives.FirstOrDefaultAsync(x => x.ProjectId == projectId && x.VolumeNumber == volumeNumber, ct);
                if (archive == null)
                {
                    archive = new VolumeFactArchive
                    {
                        Id = StableId(projectId, "archive", volumeNumber.ToString()),
                        ProjectId = projectId,
                        VolumeNumber = volumeNumber
                    };
                    _db.VolumeFactArchives.Add(archive);
                    count++;
                }

                archive.VolumeId = ReadString(doc.RootElement, "VolumeId", "volumeId") ?? volumeNumber.ToString();
                archive.LastChapterId = ReadString(doc.RootElement, "LastChapterId", "lastChapterId") ?? string.Empty;
                archive.ArchivedAt = ReadDate(doc.RootElement, "ArchivedAt", "archivedAt") ?? DateTime.UtcNow;
                archive.SnapshotPayload = json;
            }
            catch (Exception ex)
            {
                warnings.Add($"导入 fact archive 失败 {file}：{ex.Message}");
            }
        }

        return count;
    }

    private async Task<int> ImportMilestonesAsync(string projectId, string milestonesDir, List<string> warnings, CancellationToken ct)
    {
        if (!Directory.Exists(milestonesDir))
            return 0;

        var count = 0;
        foreach (var file in Directory.GetFiles(milestonesDir, "vol*.txt"))
        {
            try
            {
                var name = Path.GetFileNameWithoutExtension(file).Replace("vol", "", StringComparison.OrdinalIgnoreCase);
                if (!int.TryParse(name, out var volumeNumber))
                    continue;

                var volume = await _db.Volumes.FirstOrDefaultAsync(x => x.ProjectId == projectId && x.VolumeNumber == volumeNumber, ct);
                if (volume == null)
                    continue;

                volume.MilestoneText = await File.ReadAllTextAsync(file, ct);
                count++;
            }
            catch (Exception ex)
            {
                warnings.Add($"导入 milestone 失败 {file}：{ex.Message}");
            }
        }

        return count;
    }

    private async Task<int> ImportValidationSummariesAsync(string projectId, List<string> warnings, CancellationToken ct)
    {
        var dir = Path.Combine(ResolveStorageRoot(), "Modules", "Validate", "ValidationSummary", "data");
        if (!Directory.Exists(dir))
            return 0;

        var count = 0;
        foreach (var file in Directory.GetFiles(dir, "*.json"))
        {
            try
            {
                var json = await File.ReadAllTextAsync(file, ct);
                using var doc = JsonDocument.Parse(json);
                var id = ReadString(doc.RootElement, "Id") ?? StableId(projectId, "validation-summary", Path.GetFileNameWithoutExtension(file));
                var summary = await _db.ValidationSummaries.FirstOrDefaultAsync(x => x.Id == id, ct);
                if (summary == null)
                {
                    summary = new ValidationSummary { Id = id, ProjectId = projectId };
                    _db.ValidationSummaries.Add(summary);
                    count++;
                }

                summary.TargetVolumeNumber = ReadInt(doc.RootElement, "TargetVolumeNumber", "targetVolumeNumber");
                summary.OverallResult = ReadString(doc.RootElement, "OverallResult", "overallResult") ?? summary.OverallResult;
                summary.ModuleResults = ReadJsonOrDefault(doc.RootElement, "ModuleResults", "[]");
                summary.ProblemItems = ReadJsonOrDefault(doc.RootElement, "ProblemItems", "[]");
                summary.LastValidatedAt = ReadDate(doc.RootElement, "LastValidatedTime", "lastValidatedTime") ?? DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                warnings.Add($"导入 ValidationSummary 失败 {file}：{ex.Message}");
            }
        }
        return count;
    }

    private async Task<int> ImportValidationReportsAsync(string projectId, List<string> warnings, CancellationToken ct)
    {
        var projectsDir = Path.Combine(ResolveStorageRoot(), "Projects");
        if (!Directory.Exists(projectsDir))
            return 0;

        var count = 0;
        foreach (var projectDir in Directory.GetDirectories(projectsDir))
        {
            var reportsDir = Path.Combine(projectDir, "Validation", "reports");
            if (!Directory.Exists(reportsDir))
                continue;

            foreach (var chapterDir in Directory.GetDirectories(reportsDir))
            {
                var chapterId = Path.GetFileName(chapterDir);
                foreach (var file in Directory.GetFiles(chapterDir, "*.json"))
                {
                    try
                    {
                        var json = await File.ReadAllTextAsync(file, ct);
                        using var doc = JsonDocument.Parse(json);
                        var reportId = ReadString(doc.RootElement, "Id") ?? StableId(projectId, "validation-report", chapterId, Path.GetFileNameWithoutExtension(file));

                        if (await _db.ValidationReports.AnyAsync(x => x.Id == reportId, ct))
                            continue;

                        _db.ValidationReports.Add(new ValidationReport
                        {
                            Id = reportId,
                            ProjectId = projectId,
                            ChapterId = ReadString(doc.RootElement, "ChapterId") ?? chapterId,
                            ValidatedAt = ReadDate(doc.RootElement, "ValidatedTime", "validatedTime") ?? DateTime.UtcNow,
                            Result = NormalizeValidationResult(ReadString(doc.RootElement, "Result")),
                            Summary = ReadString(doc.RootElement, "Summary") ?? string.Empty
                        });
                        count++;

                        if (TryGet(doc.RootElement, "Items", out var items) && items.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var item in items.EnumerateArray())
                            {
                                _db.ValidationItems.Add(new ValidationItem
                                {
                                    Id = StableId(reportId, ReadString(item, "ValidationType") ?? string.Empty, ReadString(item, "Name") ?? string.Empty),
                                    ValidationReportId = reportId,
                                    ValidationType = ReadString(item, "ValidationType") ?? string.Empty,
                                    Name = ReadString(item, "Name") ?? string.Empty,
                                    Result = NormalizeValidationItemResult(ReadString(item, "Result")),
                                    Details = ReadString(item, "Details") ?? string.Empty,
                                    Suggestion = ReadString(item, "Suggestion") ?? string.Empty
                                });
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        warnings.Add($"导入 ValidationReport 失败 {file}：{ex.Message}");
                    }
                }
            }
        }
        return count;
    }

    private static string? ReadString(JsonElement root, params string[] names)
    {
        foreach (var name in names)
        {
            if (TryGet(root, name, out var value) && value.ValueKind == JsonValueKind.String)
                return value.GetString();
        }
        return null;
    }

    private static int ReadInt(JsonElement root, params string[] names)
    {
        foreach (var name in names)
        {
            if (!TryGet(root, name, out var value)) continue;
            if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var i)) return i;
            if (value.ValueKind == JsonValueKind.String && int.TryParse(value.GetString(), out var s)) return s;
        }
        return 0;
    }

    private static long ReadLong(JsonElement root, params string[] names)
    {
        foreach (var name in names)
        {
            if (!TryGet(root, name, out var value)) continue;
            if (value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out var i)) return i;
            if (value.ValueKind == JsonValueKind.String && long.TryParse(value.GetString(), out var s)) return s;
        }
        return 0;
    }

    private static bool ReadBool(JsonElement root, params string[] names)
    {
        foreach (var name in names)
        {
            if (!TryGet(root, name, out var value)) continue;
            if (value.ValueKind == JsonValueKind.True || value.ValueKind == JsonValueKind.False) return value.GetBoolean();
            if (value.ValueKind == JsonValueKind.String && bool.TryParse(value.GetString(), out var b)) return b;
        }
        return false;
    }

    private static DateTime? ReadDate(JsonElement root, params string[] names)
    {
        foreach (var name in names)
        {
            if (!TryGet(root, name, out var value)) continue;
            if (value.ValueKind == JsonValueKind.String && DateTime.TryParse(value.GetString(), out var dt)) return dt;
        }
        return null;
    }

    private static List<string> ReadStringArray(JsonElement root, params string[] names)
    {
        foreach (var name in names)
        {
            if (!TryGet(root, name, out var value)) continue;
            if (value.ValueKind != JsonValueKind.Array) continue;
            var result = new List<string>();
            foreach (var item in value.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.String)
                {
                    var s = item.GetString();
                    if (!string.IsNullOrWhiteSpace(s))
                        result.Add(s);
                }
            }
            return result;
        }
        return new List<string>();
    }

    private static string ReadJsonOrDefault(JsonElement root, string name, string fallbackJson)
    {
        if (TryGet(root, name, out var value))
        {
            return value.ValueKind switch
            {
                JsonValueKind.String => value.GetString() ?? fallbackJson,
                JsonValueKind.Array or JsonValueKind.Object => value.GetRawText(),
                _ => fallbackJson
            };
        }
        return fallbackJson;
    }

    private static string NormalizeValidationResult(string? value)
        => value?.ToLowerInvariant() switch
        {
            "pass" or "passed" or "通过" => "passed",
            "warning" or "warn" or "警告" => "warning",
            "error" or "failed" or "失败" => "failed",
            _ => "pending"
        };

    private static string NormalizeValidationItemResult(string? value)
        => value?.ToLowerInvariant() switch
        {
            "pass" or "passed" or "通过" => "passed",
            "warning" or "warn" or "警告" => "warning",
            "error" or "failed" or "失败" => "error",
            "skipped" or "跳过" => "skipped",
            _ => "pending"
        };

    private static bool TryGet(JsonElement root, string name, out JsonElement value)
    {
        if (root.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in root.EnumerateObject())
            {
                if (string.Equals(prop.Name, name, StringComparison.OrdinalIgnoreCase))
                {
                    value = prop.Value;
                    return true;
                }
            }
        }

        value = default;
        return false;
    }

    private static int ReadStrength(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var n))
            return n;
        if (value.ValueKind == JsonValueKind.String)
        {
            var s = value.GetString();
            if (int.TryParse(s, out n)) return n;
            return s?.ToLowerInvariant() switch
            {
                "strong" => 100,
                "medium" => 60,
                "weak" => 30,
                _ => 0
            };
        }
        if (value.ValueKind == JsonValueKind.Object)
            return ReadInt(value, "Strength", "Value", "strength", "value");
        return 0;
    }

    private static string StableId(params string[] parts)
    {
        var raw = string.Join(":", parts.Where(p => !string.IsNullOrWhiteSpace(p)));
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(hash).ToLowerInvariant()[..32];
    }

    private async Task WriteReportAsync(ImportReport report, CancellationToken ct)
    {
        try
        {
            var reportPath = Path.Combine(ResolveStorageRoot(), $"import-report-{DateTime.UtcNow:yyyyMMddHHmmss}.json");
            var json = JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true });
            await File.WriteAllTextAsync(reportPath, json, ct);
            _logger.LogInformation("导入报告已写到 {Path}", reportPath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "写入 import-report.json 失败");
        }
    }

    private string ResolveStorageRoot()
    {
        var conn = _db.Database.GetDbConnection().ConnectionString;
        // 简单从 connection string 反推 Data Source 所在目录
        var dataSource = conn.Split(';').FirstOrDefault(p => p.StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase));
        if (dataSource != null)
        {
            var path = dataSource.Substring("Data Source=".Length).Trim();
            var dir = Path.GetDirectoryName(path);
            if (!string.IsNullOrEmpty(dir)) return dir;
        }
        return Path.Combine(AppContext.BaseDirectory, "Storage");
    }

    private static string SanitizeFileName(string name)
    {
        foreach (var c in Path.GetInvalidFileNameChars())
            name = name.Replace(c, '_');
        return name;
    }

    // Legacy JSON shapes - 不在 Domain 暴露，只在 import 用
    private record LegacyCategoryDto(string Id, string Name, string? ParentCategory, int Order, bool IsBuiltIn = false, bool IsEnabled = true);
    private record LegacyPromptTemplateDto(
        string Id, string Name, string? Category, string? SystemPrompt, string? UserTemplate,
        string? Variables, string? Description, bool IsBuiltIn = false, bool IsEnabled = true);
}
