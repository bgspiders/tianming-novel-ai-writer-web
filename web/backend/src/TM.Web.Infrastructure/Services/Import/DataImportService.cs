using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TM.Web.Application.Dtos.Import;
using TM.Web.Application.Services;
using TM.Web.Domain.Common;
using TM.Web.Domain.Entities.Core;
using TM.Web.Domain.Entities.Design;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Domain.Entities.Global;
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
