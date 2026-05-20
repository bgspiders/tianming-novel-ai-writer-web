using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Primitives;
using TM.Web.Application.Dtos.Editor;
using TM.Web.Domain.Entities.Core;
using TM.Web.Infrastructure.Services.Core;
using TM.Web.Infrastructure.Services.Editor;
using Xunit;

namespace TM.Web.Tests;

public class EditorServiceTests
{
    [Fact]
    public async Task SearchAsync_matches_keywords_in_title_summary_and_content()
    {
        using var storage = new TempStorage();
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var (project, volume) = await SeedProjectAsync(db);
        var titleHit = Chapter(project.Id, volume.Id, 1, "星门回响", "普通摘要", "chapters/title.md");
        var summaryHit = Chapter(project.Id, volume.Id, 2, "普通标题", "摘要写着星门线索", "chapters/summary.md");
        var contentHit = Chapter(project.Id, volume.Id, 3, "普通标题二", "普通摘要二", "chapters/content.md");

        db.Chapters.AddRange(titleHit, summaryHit, contentHit);
        await db.SaveChangesAsync();
        storage.Write(titleHit.ContentFilePath, "这里没有关键词。");
        storage.Write(summaryHit.ContentFilePath, "正文也没有关键词。");
        storage.Write(contentHit.ContentFilePath, "正文里出现了星门，并且只有正文命中。");

        var service = CreateService(db, storage.Root);
        var result = await service.SearchAsync(new EditorSearchRequest(project.Id, "星门", 10));

        result.Select(r => r.ChapterId).Should().BeEquivalentTo(new[]
        {
            titleHit.Id,
            summaryHit.Id,
            contentHit.Id
        });
        result.Should().Contain(r => r.ChapterId == titleHit.Id && r.MatchedKeywords.Contains("星门"));
        result.Should().Contain(r => r.ChapterId == summaryHit.Id && r.Summary.Contains("星门"));
        result.Should().Contain(r => r.ChapterId == contentHit.Id && r.Snippet.Contains("星门"));
    }

    [Fact]
    public async Task SearchAsync_respects_topK_and_orders_by_score_then_chapter_number()
    {
        using var storage = new TempStorage();
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var (project, volume) = await SeedProjectAsync(db);
        var strongest = Chapter(project.Id, volume.Id, 3, "星门星门", "普通摘要", "chapters/strongest.md");
        var titleHit = Chapter(project.Id, volume.Id, 1, "星门", "普通摘要", "chapters/title.md");
        var summaryHit = Chapter(project.Id, volume.Id, 2, "普通标题", "星门摘要", "chapters/summary.md");

        db.Chapters.AddRange(strongest, titleHit, summaryHit);
        await db.SaveChangesAsync();
        storage.Write(strongest.ContentFilePath, "无关键词");
        storage.Write(titleHit.ContentFilePath, "无关键词");
        storage.Write(summaryHit.ContentFilePath, "无关键词");

        var service = CreateService(db, storage.Root);
        var result = await service.SearchAsync(new EditorSearchRequest(project.Id, "星门", 2));

        result.Select(r => r.ChapterId).Should().Equal(strongest.Id, titleHit.Id);
        result.Should().HaveCount(2);
    }

    [Fact]
    public async Task SearchAsync_returns_empty_for_blank_query_or_project()
    {
        using var storage = new TempStorage();
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var (project, volume) = await SeedProjectAsync(db);
        var chapter = Chapter(project.Id, volume.Id, 1, "星门", "星门摘要", "chapters/chapter.md");
        db.Chapters.Add(chapter);
        await db.SaveChangesAsync();
        storage.Write(chapter.ContentFilePath, "星门正文");

        var service = CreateService(db, storage.Root);

        (await service.SearchAsync(new EditorSearchRequest(project.Id, "   ", 8))).Should().BeEmpty();
        (await service.SearchAsync(new EditorSearchRequest("", "星门", 8))).Should().BeEmpty();
        (await service.SearchAsync(new EditorSearchRequest(project.Id, "!", 8))).Should().BeEmpty();
    }

    [Fact]
    public async Task GetChapterAssistAsync_returns_related_chapters_and_excludes_current_chapter()
    {
        using var storage = new TempStorage();
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var (project, volume) = await SeedProjectAsync(db);
        var current = Chapter(project.Id, volume.Id, 1, "星门启航", "主角进入星门", "chapters/current.md");
        var relatedA = Chapter(project.Id, volume.Id, 2, "星门余波", "普通摘要", "chapters/related-a.md");
        var relatedB = Chapter(project.Id, volume.Id, 3, "普通标题", "星门追踪", "chapters/related-b.md");
        var unrelated = Chapter(project.Id, volume.Id, 4, "雨夜", "码头会面", "chapters/unrelated.md");

        db.Chapters.AddRange(current, relatedA, relatedB, unrelated);
        await db.SaveChangesAsync();
        storage.Write(current.ContentFilePath, "当前正文");
        storage.Write(relatedA.ContentFilePath, "相关正文");
        storage.Write(relatedB.ContentFilePath, "相关正文");
        storage.Write(unrelated.ContentFilePath, "无关正文");

        var service = CreateService(db, storage.Root);
        var assist = await service.GetChapterAssistAsync(current.Id, relatedTopK: 1);

        assist.Should().NotBeNull();
        assist!.Chapter.Id.Should().Be(current.Id);
        assist.Related.Should().HaveCount(1);
        assist.Related.Should().NotContain(r => r.ChapterId == current.Id);
        assist.Related.Single().ChapterId.Should().Be(relatedA.Id);
    }

    [Fact]
    public async Task GetIndexStatusAsync_returns_empty_status_for_blank_project_or_project_without_chapters()
    {
        using var storage = new TempStorage();
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var (project, _) = await SeedProjectAsync(db);
        var service = CreateService(db, storage.Root);

        var blank = await service.GetIndexStatusAsync("   ");
        var emptyProject = await service.GetIndexStatusAsync(project.Id);

        blank.ProjectId.Should().BeEmpty();
        blank.IndexedChapterCount.Should().Be(0);
        blank.TotalChapterCount.Should().Be(0);
        blank.KeywordCount.Should().Be(0);
        blank.LastBuiltAt.Should().BeNull();
        blank.StaleChapterCount.Should().Be(0);
        blank.Status.Should().Be("empty");

        emptyProject.ProjectId.Should().Be(project.Id);
        emptyProject.IndexedChapterCount.Should().Be(0);
        emptyProject.TotalChapterCount.Should().Be(0);
        emptyProject.KeywordCount.Should().Be(0);
        emptyProject.LastBuiltAt.Should().BeNull();
        emptyProject.StaleChapterCount.Should().Be(0);
        emptyProject.Status.Should().Be("empty");
    }

    [Fact]
    public async Task RebuildIndexAsync_returns_ready_status_for_chapters_with_title_summary_and_content()
    {
        using var storage = new TempStorage();
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var (project, volume) = await SeedProjectAsync(db);
        var chapter = Chapter(project.Id, volume.Id, 1, "星门启航", "主角发现星门线索", "chapters/indexed.md");
        db.Chapters.Add(chapter);
        await db.SaveChangesAsync();
        storage.Write(chapter.ContentFilePath, "正文写着星门开启，灵能潮汐涌入旧城。");

        var service = CreateService(db, storage.Root);
        var rebuilt = await service.RebuildIndexAsync(project.Id);

        rebuilt.ProjectId.Should().Be(project.Id);
        rebuilt.IndexedChapterCount.Should().Be(1);
        rebuilt.TotalChapterCount.Should().Be(1);
        rebuilt.KeywordCount.Should().BeGreaterThan(0);
        rebuilt.LastBuiltAt.Should().NotBeNull();
        rebuilt.StaleChapterCount.Should().Be(0);
        rebuilt.Status.Should().Be("ready");
        rebuilt.RebuiltChapterCount.Should().Be(1);
    }

    [Fact]
    public async Task GetIndexStatusAsync_reports_stale_after_saving_chapter_content()
    {
        using var storage = new TempStorage();
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var (project, volume) = await SeedProjectAsync(db);
        var chapter = Chapter(project.Id, volume.Id, 1, "星门启航", "主角发现星门线索", "chapters/stale.md");
        db.Chapters.Add(chapter);
        await db.SaveChangesAsync();
        storage.Write(chapter.ContentFilePath, "旧正文写着星门开启。");

        var service = CreateService(db, storage.Root);
        var rebuilt = await service.RebuildIndexAsync(project.Id);

        await service.SaveChapterContentAsync(
            chapter.Id,
            new EditorSaveChapterRequest("新正文加入了灵能潮汐和旧城密钥。", "drafted"));

        var statusAfterSave = await service.GetIndexStatusAsync(project.Id);

        statusAfterSave.ProjectId.Should().Be(project.Id);
        statusAfterSave.IndexedChapterCount.Should().Be(rebuilt.IndexedChapterCount);
        statusAfterSave.TotalChapterCount.Should().Be(rebuilt.TotalChapterCount);
        statusAfterSave.KeywordCount.Should().Be(rebuilt.KeywordCount);
        statusAfterSave.LastBuiltAt.Should().Be(rebuilt.LastBuiltAt);
        statusAfterSave.StaleChapterCount.Should().Be(1);
        statusAfterSave.Status.Should().Be("stale");
    }

    private static EditorService CreateService(TM.Web.Infrastructure.Persistence.AppDbContext db, string storageRoot)
    {
        var configuration = new TestConfiguration(storageRoot);

        return new EditorService(db, new ChapterService(db, configuration), configuration);
    }

    private static async Task<(Project Project, Volume Volume)> SeedProjectAsync(TM.Web.Infrastructure.Persistence.AppDbContext db)
    {
        var project = new Project { Name = $"测试项目-{Guid.NewGuid():N}" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        db.Projects.Add(project);
        db.Volumes.Add(volume);
        await db.SaveChangesAsync();
        return (project, volume);
    }

    private static Chapter Chapter(
        string projectId,
        string volumeId,
        int chapterNumber,
        string title,
        string summary,
        string contentFilePath)
        => new()
        {
            ProjectId = projectId,
            VolumeId = volumeId,
            ChapterNumber = chapterNumber,
            Title = title,
            Summary = summary,
            ContentFilePath = contentFilePath,
            Status = "drafted"
        };

    private sealed class TempStorage : IDisposable
    {
        public TempStorage()
        {
            Root = Path.Combine(Path.GetTempPath(), "tm-editor-tests", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(Root);
        }

        public string Root { get; }

        public void Write(string relativePath, string content)
        {
            var fullPath = Path.Combine(Root, relativePath.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
            File.WriteAllText(fullPath, content);
        }

        public void Dispose()
        {
            if (Directory.Exists(Root))
            {
                Directory.Delete(Root, recursive: true);
            }
        }
    }

    private sealed class TestConfiguration : IConfiguration
    {
        private readonly string _storageRoot;

        public TestConfiguration(string storageRoot)
        {
            _storageRoot = storageRoot;
        }

        public string? this[string key]
        {
            get => key == "Storage:RootPath" ? _storageRoot : null;
            set { }
        }

        public IEnumerable<IConfigurationSection> GetChildren()
            => Array.Empty<IConfigurationSection>();

        public IChangeToken GetReloadToken()
            => NoopChangeToken.Instance;

        public IConfigurationSection GetSection(string key)
            => new EmptyConfigurationSection(key);
    }

    private sealed class EmptyConfigurationSection : IConfigurationSection
    {
        public EmptyConfigurationSection(string key)
        {
            Key = key;
            Path = key;
        }

        public string? this[string key]
        {
            get => null;
            set { }
        }

        public string Key { get; }
        public string Path { get; }
        public string? Value { get; set; }

        public IEnumerable<IConfigurationSection> GetChildren()
            => Array.Empty<IConfigurationSection>();

        public IChangeToken GetReloadToken()
            => NoopChangeToken.Instance;

        public IConfigurationSection GetSection(string key)
            => new EmptyConfigurationSection(key);
    }

    private sealed class NoopChangeToken : IChangeToken
    {
        public static readonly NoopChangeToken Instance = new();

        public bool HasChanged => false;
        public bool ActiveChangeCallbacks => false;

        public IDisposable RegisterChangeCallback(Action<object?> callback, object? state)
            => EmptyDisposable.Instance;
    }

    private sealed class EmptyDisposable : IDisposable
    {
        public static readonly EmptyDisposable Instance = new();

        public void Dispose()
        {
        }
    }
}
