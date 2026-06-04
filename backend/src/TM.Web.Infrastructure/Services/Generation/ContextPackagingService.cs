using System.Text.Json;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Metadata;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Generation;

public sealed class ContextPackagingService : IContextPackagingService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly AppDbContext _db;

    public ContextPackagingService(AppDbContext db)
    {
        _db = db;
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

    private sealed record PackageFileEntry(string ModuleKey, string Path, string Hash);
}
