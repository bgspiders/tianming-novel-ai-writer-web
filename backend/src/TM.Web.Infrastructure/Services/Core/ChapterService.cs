using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Core;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Core;

public class ChapterService : IChapterService
{
    private readonly AppDbContext _db;
    private readonly string _storageRoot;

    public ChapterService(AppDbContext db, IConfiguration configuration)
    {
        _db = db;
        _storageRoot = DbServiceCollectionExtensions.ResolveStorageRoot(configuration);
    }

    public async Task<IReadOnlyList<ChapterDto>> ListAsync(string projectId, string? volumeId = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(projectId)) return Array.Empty<ChapterDto>();

        var q = _db.Chapters.AsQueryable().Where(c => c.ProjectId == projectId);
        if (!string.IsNullOrWhiteSpace(volumeId)) q = q.Where(c => c.VolumeId == volumeId);

        var rows = await q.OrderBy(c => c.ChapterNumber).ToListAsync(ct);
        return rows.Select(c => ToDto(c, readContent: false)).ToList();
    }

    public async Task<ChapterDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var entity = await _db.Chapters.FindAsync(new object?[] { id }, ct);
        return entity == null ? null : ToDto(entity, readContent: true);
    }

    public async Task<ChapterDto> CreateAsync(ChapterUpsertDto input, CancellationToken ct = default)
    {
        await ValidateAsync(input, null, ct);

        var entity = new Chapter
        {
            ProjectId = input.ProjectId,
            VolumeId = input.VolumeId,
            ChapterNumber = input.ChapterNumber,
            Title = input.Title.Trim(),
            Summary = input.Summary ?? string.Empty,
            Status = NormalizeStatus(input.Status),
            WordCount = CountWords(input.Content)
        };
        entity.ContentFilePath = BuildRelativeContentPath(entity.ProjectId, entity.Id);

        if (!string.IsNullOrWhiteSpace(input.Content))
        {
            await WriteContentAsync(entity.ContentFilePath, input.Content, ct);
        }

        _db.Chapters.Add(entity);
        await _db.SaveChangesAsync(ct);
        return ToDto(entity, readContent: true);
    }

    public async Task<ChapterDto> UpdateAsync(string id, ChapterUpsertDto input, CancellationToken ct = default)
    {
        var entity = await _db.Chapters.FindAsync(new object?[] { id }, ct)
                     ?? throw new InvalidOperationException("章节不存在。");

        await ValidateAsync(input, id, ct);

        entity.ProjectId = input.ProjectId;
        entity.VolumeId = input.VolumeId;
        entity.ChapterNumber = input.ChapterNumber;
        entity.Title = input.Title.Trim();
        entity.Summary = input.Summary ?? string.Empty;
        entity.Status = NormalizeStatus(input.Status);
        if (string.IsNullOrWhiteSpace(entity.ContentFilePath))
        {
            entity.ContentFilePath = BuildRelativeContentPath(entity.ProjectId, entity.Id);
        }

        if (!string.IsNullOrWhiteSpace(input.Content))
        {
            await WriteContentAsync(entity.ContentFilePath, input.Content, ct);
            entity.WordCount = CountWords(input.Content);
        }

        await _db.SaveChangesAsync(ct);
        return ToDto(entity, readContent: true);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var entity = await _db.Chapters.FindAsync(new object?[] { id }, ct);
        if (entity == null) return;

        _db.Chapters.Remove(entity);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<ChapterDto> SaveContentAsync(string id, string content, string status = "drafted", CancellationToken ct = default)
    {
        var entity = await _db.Chapters.FindAsync(new object?[] { id }, ct)
                     ?? throw new InvalidOperationException("章节不存在。");

        if (string.IsNullOrWhiteSpace(entity.ContentFilePath))
        {
            entity.ContentFilePath = BuildRelativeContentPath(entity.ProjectId, entity.Id);
        }

        await WriteContentAsync(entity.ContentFilePath, content ?? string.Empty, ct);
        entity.WordCount = CountWords(content);
        entity.Status = NormalizeStatus(status);

        await _db.SaveChangesAsync(ct);
        return ToDto(entity, readContent: true);
    }

    private async Task ValidateAsync(ChapterUpsertDto input, string? currentId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.ProjectId)) throw new InvalidOperationException("项目 ID 不能为空。");
        if (string.IsNullOrWhiteSpace(input.VolumeId)) throw new InvalidOperationException("分卷 ID 不能为空。");
        if (input.ChapterNumber <= 0) throw new InvalidOperationException("章节号必须大于 0。");
        if (string.IsNullOrWhiteSpace(input.Title)) throw new InvalidOperationException("章节标题不能为空。");

        var volume = await _db.Volumes.FirstOrDefaultAsync(v => v.Id == input.VolumeId, ct)
                     ?? throw new InvalidOperationException($"分卷 {input.VolumeId} 不存在。");
        if (volume.ProjectId != input.ProjectId)
            throw new InvalidOperationException("分卷不属于当前项目。");

        var duplicated = await _db.Chapters.AnyAsync(c =>
            c.VolumeId == input.VolumeId &&
            c.ChapterNumber == input.ChapterNumber &&
            (currentId == null || c.Id != currentId), ct);
        if (duplicated) throw new InvalidOperationException($"第 {input.ChapterNumber} 章已存在。");
    }

    private string ResolveContentPath(string relativePath)
        => Path.Combine(_storageRoot, relativePath.Replace('/', Path.DirectorySeparatorChar));

    private static string BuildRelativeContentPath(string projectId, string chapterId)
        => Path.Combine("projects", projectId, "chapters", $"{chapterId}.md").Replace('\\', '/');

    private async Task WriteContentAsync(string relativePath, string content, CancellationToken ct)
    {
        var fullPath = ResolveContentPath(relativePath);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        await File.WriteAllTextAsync(fullPath, content ?? string.Empty, ct);
    }

    private string ReadContent(string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath)) return string.Empty;
        var fullPath = ResolveContentPath(relativePath);
        return File.Exists(fullPath) ? File.ReadAllText(fullPath) : string.Empty;
    }

    private ChapterDto ToDto(Chapter c, bool readContent)
        => new(c.Id, c.ProjectId, c.VolumeId, c.ChapterNumber, c.Title,
            c.WordCount, c.Summary, readContent ? ReadContent(c.ContentFilePath) : string.Empty,
            c.ContentFilePath, c.Status, c.CreatedAt, c.UpdatedAt);

    private static string NormalizeStatus(string? status)
        => string.IsNullOrWhiteSpace(status) ? "planned" : status.Trim();

    private static int CountWords(string? content)
        => string.IsNullOrWhiteSpace(content)
            ? 0
            : content.Count(c => !char.IsWhiteSpace(c));
}
