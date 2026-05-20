using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using TM.Web.Application.Dtos.Editor;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Core;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Editor;

public class ChapterEditorService : IChapterEditorService
{
    private static readonly Regex CodeFenceRegex = new("```.*?```", RegexOptions.Singleline | RegexOptions.Compiled);
    private static readonly Regex InlineCodeRegex = new("`([^`]*)`", RegexOptions.Compiled);
    private static readonly Regex ImageRegex = new("!\\[[^\\]]*\\]\\([^\\)]*\\)", RegexOptions.Compiled);
    private static readonly Regex LinkRegex = new("\\[([^\\]]+)\\]\\([^\\)]*\\)", RegexOptions.Compiled);
    private static readonly Regex HtmlRegex = new("<[^>]+>", RegexOptions.Compiled);
    private static readonly Regex MarkdownLinePrefixRegex = new("^\\s{0,3}(#{1,6}|>|[-*+]|\\d+\\.)\\s?", RegexOptions.Multiline | RegexOptions.Compiled);
    private static readonly Regex MarkdownStyleRegex = new("[*_~#>-]", RegexOptions.Compiled);
    private static readonly Regex WhitespaceRegex = new("\\s+", RegexOptions.Compiled);

    private readonly AppDbContext _db;
    private readonly string _storageRoot;

    public ChapterEditorService(AppDbContext db, IConfiguration configuration)
    {
        _db = db;
        _storageRoot = DbServiceCollectionExtensions.ResolveStorageRoot(configuration);
    }

    public async Task<IReadOnlyList<ChapterListItemDto>> ListAsync(
        string? projectId,
        string? sourceBookId,
        string? keyword,
        CancellationToken ct = default)
    {
        var query =
            from chapter in _db.Chapters.AsNoTracking()
            join volume in _db.Volumes.AsNoTracking() on chapter.VolumeId equals volume.Id into volumeJoin
            from volume in volumeJoin.DefaultIfEmpty()
            join project in _db.Projects.AsNoTracking() on chapter.ProjectId equals project.Id into projectJoin
            from project in projectJoin.DefaultIfEmpty()
            select new { chapter, volume, project };

        if (!string.IsNullOrWhiteSpace(projectId))
        {
            var normalizedProjectId = projectId.Trim();
            query = query.Where(x => x.chapter.ProjectId == normalizedProjectId);
        }

        if (!string.IsNullOrWhiteSpace(sourceBookId))
        {
            var normalizedSourceBookId = sourceBookId.Trim();
            query = query.Where(x => x.project != null && x.project.CurrentSourceBookId == normalizedSourceBookId);
        }

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var normalizedKeyword = keyword.Trim();
            query = query.Where(x =>
                x.chapter.Title.Contains(normalizedKeyword) ||
                x.chapter.Summary.Contains(normalizedKeyword));
        }

        return await query
            .OrderBy(x => x.chapter.ProjectId)
            .ThenBy(x => x.volume != null ? x.volume.VolumeNumber : 0)
            .ThenBy(x => x.chapter.ChapterNumber)
            .Select(x => new ChapterListItemDto(
                x.chapter.Id,
                x.chapter.ProjectId,
                x.project != null ? x.project.Name : null,
                x.project != null ? x.project.CurrentSourceBookId : null,
                x.chapter.VolumeId,
                x.volume != null ? x.volume.VolumeNumber : 0,
                x.volume != null ? x.volume.Title : null,
                x.chapter.ChapterNumber,
                x.chapter.Title,
                x.chapter.Summary,
                x.chapter.WordCount,
                x.chapter.Status,
                x.chapter.ContentFilePath,
                x.chapter.CreatedAt,
                x.chapter.UpdatedAt))
            .ToListAsync(ct);
    }

    public async Task<ChapterDetailDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var row = await (
            from chapter in _db.Chapters.AsNoTracking()
            join volume in _db.Volumes.AsNoTracking() on chapter.VolumeId equals volume.Id into volumeJoin
            from volume in volumeJoin.DefaultIfEmpty()
            join project in _db.Projects.AsNoTracking() on chapter.ProjectId equals project.Id into projectJoin
            from project in projectJoin.DefaultIfEmpty()
            where chapter.Id == id
            select new
            {
                chapter.Id,
                chapter.ProjectId,
                ProjectName = project != null ? project.Name : null,
                SourceBookId = project != null ? project.CurrentSourceBookId : null,
                chapter.VolumeId,
                VolumeNumber = volume != null ? volume.VolumeNumber : 0,
                VolumeTitle = volume != null ? volume.Title : null,
                chapter.ChapterNumber,
                chapter.Title,
                chapter.Summary,
                chapter.WordCount,
                chapter.Status,
                chapter.ContentFilePath,
                chapter.CreatedAt,
                chapter.UpdatedAt
            })
            .FirstOrDefaultAsync(ct);

        if (row == null)
        {
            return null;
        }

        var content = await ReadContentAsync(row.ContentFilePath, ct);

        return new ChapterDetailDto(
            row.Id,
            row.ProjectId,
            row.ProjectName,
            row.SourceBookId,
            row.VolumeId,
            row.VolumeNumber,
            row.VolumeTitle,
            row.ChapterNumber,
            row.Title,
            row.Summary,
            row.WordCount,
            row.Status,
            row.ContentFilePath,
            content,
            row.CreatedAt,
            row.UpdatedAt);
    }

    public async Task<ChapterDetailDto> UpdateContentAsync(string id, ChapterContentUpdateDto input, CancellationToken ct = default)
    {
        var chapter = await _db.Chapters.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new InvalidOperationException("章节不存在。");

        if (string.IsNullOrWhiteSpace(chapter.ContentFilePath))
        {
            throw new InvalidOperationException("章节未配置正文文件路径。");
        }

        var previousContent = await ReadContentAsync(chapter.ContentFilePath, ct);
        var newContent = input.Content ?? string.Empty;

        var fullPath = ResolveContentPath(chapter.ContentFilePath);
        var directoryPath = Path.GetDirectoryName(fullPath);
        if (!string.IsNullOrWhiteSpace(directoryPath))
        {
            Directory.CreateDirectory(directoryPath);
        }

        if (!string.IsNullOrWhiteSpace(previousContent) && !string.Equals(previousContent, newContent, StringComparison.Ordinal))
        {
            await SaveVersionSnapshotAsync(chapter, previousContent, ct);
        }

        await File.WriteAllTextAsync(fullPath, newContent, ct);

        var plainText = ToPlainText(newContent);
        chapter.WordCount = CountWordUnits(plainText);

        var oldAutoSummary = GenerateSummary(previousContent);
        var newAutoSummary = GenerateSummary(newContent);
        if (string.IsNullOrWhiteSpace(chapter.Summary) || string.Equals(chapter.Summary, oldAutoSummary, StringComparison.Ordinal))
        {
            chapter.Summary = newAutoSummary;
        }

        chapter.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return await GetAsync(id, ct) ?? throw new InvalidOperationException("章节不存在。");
    }

    public async Task<IReadOnlyList<ChapterVersionItemDto>> GetVersionsAsync(string id, CancellationToken ct = default)
    {
        var chapter = await _db.Chapters
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new InvalidOperationException("章节不存在。");

        var items = new List<ChapterVersionItemDto>();

        var currentPath = ResolveContentPath(chapter.ContentFilePath);
        if (File.Exists(currentPath))
        {
            var currentInfo = new FileInfo(currentPath);
            items.Add(new ChapterVersionItemDto(
                "current",
                "当前版本",
                currentInfo.Name,
                currentInfo.LastWriteTimeUtc,
                currentInfo.Length,
                true));
        }

        var versionDirectory = ResolveVersionDirectory(chapter);
        if (!Directory.Exists(versionDirectory))
        {
            return items;
        }

        var historyItems = Directory.GetFiles(versionDirectory, "*.md", SearchOption.TopDirectoryOnly)
            .Select(path => new FileInfo(path))
            .OrderByDescending(file => file.LastWriteTimeUtc)
            .Select(file => new ChapterVersionItemDto(
                Path.GetFileNameWithoutExtension(file.Name),
                BuildVersionLabel(file),
                file.Name,
                file.LastWriteTimeUtc,
                file.Length,
                false));

        items.AddRange(historyItems);
        return items;
    }

    public async Task<ChapterVersionDetailDto?> GetVersionAsync(string id, string versionId, CancellationToken ct = default)
    {
        var chapter = await _db.Chapters
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (chapter == null)
        {
            return null;
        }

        if (string.Equals(versionId, "current", StringComparison.OrdinalIgnoreCase))
        {
            var currentPath = ResolveContentPath(chapter.ContentFilePath);
            if (!File.Exists(currentPath))
            {
                return null;
            }

            var currentInfo = new FileInfo(currentPath);
            var currentContent = await File.ReadAllTextAsync(currentPath, ct);
            return new ChapterVersionDetailDto(
                "current",
                "当前版本",
                currentInfo.Name,
                currentInfo.LastWriteTimeUtc,
                currentInfo.Length,
                currentContent);
        }

        var safeVersionId = SanitizeVersionId(versionId);
        var versionPath = Path.Combine(ResolveVersionDirectory(chapter), $"{safeVersionId}.md");
        if (!File.Exists(versionPath))
        {
            return null;
        }

        var info = new FileInfo(versionPath);
        var content = await File.ReadAllTextAsync(versionPath, ct);
        return new ChapterVersionDetailDto(
            safeVersionId,
            BuildVersionLabel(info),
            info.Name,
            info.LastWriteTimeUtc,
            info.Length,
            content);
    }

    public async Task<ChapterDetailDto> RestoreVersionAsync(string id, string versionId, CancellationToken ct = default)
    {
        var version = await GetVersionAsync(id, versionId, ct)
            ?? throw new InvalidOperationException("指定版本不存在。");

        return await UpdateContentAsync(id, new ChapterContentUpdateDto(version.Content), ct);
    }

    private async Task<string> ReadContentAsync(string relativePath, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
        {
            return string.Empty;
        }

        var fullPath = ResolveContentPath(relativePath);
        if (!File.Exists(fullPath))
        {
            return string.Empty;
        }

        return await File.ReadAllTextAsync(fullPath, ct);
    }

    private async Task SaveVersionSnapshotAsync(Chapter chapter, string previousContent, CancellationToken ct)
    {
        var versionDirectory = ResolveVersionDirectory(chapter);
        Directory.CreateDirectory(versionDirectory);

        var stamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
        var suffix = chapter.Id[..Math.Min(8, chapter.Id.Length)];
        var versionId = $"{stamp}_{suffix}";
        var filePath = Path.Combine(versionDirectory, $"{versionId}.md");

        await File.WriteAllTextAsync(filePath, previousContent, ct);
    }

    private string ResolveVersionDirectory(Chapter chapter)
    {
        var chapterPath = ResolveContentPath(chapter.ContentFilePath);
        var chapterDir = Path.GetDirectoryName(chapterPath)
            ?? throw new InvalidOperationException("章节正文目录不存在。");

        return Path.Combine(chapterDir, "History", chapter.Id);
    }

    private string ResolveContentPath(string relativePath)
    {
        var storageRoot = Path.GetFullPath(_storageRoot);
        var fullPath = Path.IsPathRooted(relativePath)
            ? Path.GetFullPath(relativePath)
            : Path.GetFullPath(Path.Combine(storageRoot, relativePath));

        var normalizedRoot = EnsureTrailingSeparator(storageRoot);
        if (!fullPath.StartsWith(normalizedRoot, StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(fullPath, storageRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("章节正文文件路径超出存储根目录。");
        }

        return fullPath;
    }

    private static string EnsureTrailingSeparator(string path)
        => path.EndsWith(Path.DirectorySeparatorChar) || path.EndsWith(Path.AltDirectorySeparatorChar)
            ? path
            : path + Path.DirectorySeparatorChar;

    private static string BuildVersionLabel(FileInfo file)
        => file.LastWriteTimeUtc.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss");

    private static string GenerateSummary(string markdown)
    {
        var plainText = ToPlainText(markdown);
        if (string.IsNullOrWhiteSpace(plainText))
        {
            return string.Empty;
        }

        const int maxLength = 180;
        return plainText.Length <= maxLength
            ? plainText
            : plainText[..maxLength].Trim();
    }

    private static string ToPlainText(string markdown)
    {
        if (string.IsNullOrWhiteSpace(markdown))
        {
            return string.Empty;
        }

        var text = markdown.Replace("\r\n", "\n");
        text = CodeFenceRegex.Replace(text, " ");
        text = InlineCodeRegex.Replace(text, "$1");
        text = ImageRegex.Replace(text, " ");
        text = LinkRegex.Replace(text, "$1");
        text = HtmlRegex.Replace(text, " ");
        text = MarkdownLinePrefixRegex.Replace(text, string.Empty);
        text = MarkdownStyleRegex.Replace(text, string.Empty);
        text = WhitespaceRegex.Replace(text, " ");

        return text.Trim();
    }

    private static int CountWordUnits(string plainText)
    {
        if (string.IsNullOrWhiteSpace(plainText))
        {
            return 0;
        }

        var count = 0;
        var inToken = false;

        foreach (var ch in plainText)
        {
            if (IsCjk(ch))
            {
                count++;
                inToken = false;
                continue;
            }

            if (char.IsLetterOrDigit(ch))
            {
                if (!inToken)
                {
                    count++;
                    inToken = true;
                }

                continue;
            }

            inToken = false;
        }

        return count;
    }

    private static bool IsCjk(char ch)
        => ch is >= '\u3400' and <= '\u4DBF'
            or >= '\u4E00' and <= '\u9FFF'
            or >= '\uF900' and <= '\uFAFF';

    private static string SanitizeVersionId(string value)
        => new string(value.Where(ch => char.IsLetterOrDigit(ch) || ch is '_' or '-').ToArray());
}
