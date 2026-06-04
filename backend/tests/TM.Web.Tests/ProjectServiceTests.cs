using FluentAssertions;
using TM.Web.Application.Dtos.Core;
using TM.Web.Domain.Entities.Core;
using TM.Web.Domain.Entities.Runtime;
using TM.Web.Domain.Entities.Tracking;
using TM.Web.Domain.Entities.Validation;
using TM.Web.Infrastructure.Services.Core;
using Xunit;

namespace TM.Web.Tests;

public class ProjectServiceTests
{
    [Fact]
    public async Task DeleteAsync_removes_project_scoped_data()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var project = new Project { Name = "待删除项目" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        var chapter = new Chapter
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterNumber = 1,
            Title = "第一章",
            Summary = "摘要",
            ContentFilePath = "projects/p/chapters/001.md"
        };
        var chat = new ChatSession { ProjectId = project.Id, Title = "开书会话" };
        db.Projects.Add(project);
        db.Volumes.Add(volume);
        db.Chapters.Add(chapter);
        db.GenerationRecords.Add(new GenerationRecord { ProjectId = project.Id, ChapterId = chapter.Id, Success = true });
        db.GenerationStatistics.Add(new GenerationStatistics { ProjectId = project.Id, TotalGenerations = 1 });
        db.ValidationReports.Add(new ValidationReport { ProjectId = project.Id, ChapterId = chapter.Id, RunId = "run-1" });
        db.CharacterLocations.Add(new CharacterLocation { ProjectId = project.Id, CharacterName = "沈栀", CurrentLocation = "第三潮汐塔" });
        db.ChatSessions.Add(chat);
        db.ChatMessages.Add(new ChatMessage { ChatSessionId = chat.Id, Role = "user", Content = "测试" });
        await db.SaveChangesAsync();

        await new ProjectService(db).DeleteAsync(project.Id);
        db.ChangeTracker.Clear();

        (await db.Projects.FindAsync(project.Id)).Should().BeNull();
        db.Volumes.Should().BeEmpty();
        db.Chapters.Should().BeEmpty();
        db.GenerationRecords.Should().BeEmpty();
        db.GenerationStatistics.Should().BeEmpty();
        db.ValidationReports.Should().BeEmpty();
        db.CharacterLocations.Should().BeEmpty();
        db.ChatSessions.Should().BeEmpty();
        db.ChatMessages.Should().BeEmpty();
    }

    [Fact]
    public async Task DeleteAsync_keeps_other_projects()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var deleted = await new ProjectService(db).CreateAsync(new ProjectUpsertDto("删除我", null, null));
        var kept = await new ProjectService(db).CreateAsync(new ProjectUpsertDto("保留我", null, null));

        await new ProjectService(db).DeleteAsync(deleted.Id);
        db.ChangeTracker.Clear();

        (await db.Projects.FindAsync(deleted.Id)).Should().BeNull();
        (await db.Projects.FindAsync(kept.Id)).Should().NotBeNull();
    }
}
