using FluentAssertions;
using Microsoft.Extensions.Configuration;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Domain.Entities.Core;
using TM.Web.Domain.Entities.Tracking;
using TM.Web.Infrastructure.Services.Generation;
using Xunit;

namespace TM.Web.Tests;

public class ChapterAnalysisTrackingTests
{
    [Fact]
    public async Task AnalyzeAsync_blocks_chapter_when_planned_foreshadowing_payoff_is_missing()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;
        var project = new Project { Name = "长篇项目", CurrentSourceBookId = "book-1" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        var chapter = new Chapter
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterNumber = 12,
            Title = "潮汐塔终局",
            Summary = "沈栀完成突围，潮汐财团撤退。"
        };
        db.AddRange(project, volume, chapter, new Foreshadowing
        {
            ProjectId = project.Id,
            SourceBookId = "book-1",
            Name = "潮汐密钥真相",
            Tier = "Tier-1",
            ExpectedPayoffChapter = "第12章",
            IsSetup = true,
            IsResolved = false
        });
        await db.SaveChangesAsync();
        var service = new ChapterAnalysisService(db, new ConfigurationBuilder().Build());

        var result = await service.AnalyzeAsync(new ChapterAnalysisRequest
        {
            ProjectId = project.Id,
            ChapterId = chapter.Id,
            MinWordCount = 0
        });

        result.ShouldPauseBatch.Should().BeTrue();
        result.Items.Should().Contain(x =>
            x.Code == "planned_foreshadowing_payoff_missing"
            && x.Severity == "fatal"
            && x.Message.Contains("潮汐密钥真相"));
    }
}
