using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Tracking;
using TM.Web.Domain.Entities.Core;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Domain.Entities.Tracking;
using TM.Web.Infrastructure.Services.Tracking;
using Xunit;

namespace TM.Web.Tests;

public class NarrativeTrackingServiceTests
{
    [Fact]
    public async Task Foreshadowings_can_be_created_updated_listed_and_deleted()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;
        var project = new Project { Name = "长篇项目", CurrentSourceBookId = "book-1" };
        db.Projects.Add(project);
        await db.SaveChangesAsync();
        var service = new NarrativeTrackingService(db);

        var created = await service.CreateForeshadowingAsync(new ForeshadowingUpsertDto
        {
            ProjectId = project.Id,
            SourceBookId = "book-1",
            Name = "潮汐密钥真相",
            Tier = "Tier-1",
            ExpectedSetupChapter = "第1章",
            ExpectedPayoffChapter = "第12章"
        });

        var updated = await service.UpdateForeshadowingAsync(created.Id, new ForeshadowingUpsertDto
        {
            ProjectId = project.Id,
            SourceBookId = "book-1",
            Name = "潮汐密钥真相",
            Tier = "Tier-1",
            IsSetup = true,
            IsResolved = true,
            ExpectedSetupChapter = "第1章",
            ExpectedPayoffChapter = "第12章",
            ActualSetupChapter = "第1章",
            ActualPayoffChapter = "第12章"
        });

        updated.IsResolved.Should().BeTrue();
        var rows = await service.ListForeshadowingsAsync(new TrackingListQuery { ProjectId = project.Id, SourceBookId = "book-1" });
        rows.Should().ContainSingle(x => x.Name == "潮汐密钥真相" && x.Tier == "Tier-1");

        await service.DeleteForeshadowingAsync(created.Id);

        (await db.Foreshadowings.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Timelines_are_listed_by_chapter_order_with_chapter_titles()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;
        var project = new Project { Name = "长篇项目", CurrentSourceBookId = "book-1" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        var chapter2 = new Chapter { ProjectId = project.Id, VolumeId = volume.Id, ChapterNumber = 2, Title = "第二章" };
        var chapter1 = new Chapter { ProjectId = project.Id, VolumeId = volume.Id, ChapterNumber = 1, Title = "第一章" };
        db.AddRange(project, volume, chapter2, chapter1);
        await db.SaveChangesAsync();
        var service = new NarrativeTrackingService(db);

        await service.CreateTimelineAsync(new TimelineUpsertDto
        {
            ProjectId = project.Id,
            SourceBookId = "book-1",
            ChapterId = chapter2.Id,
            TimePeriod = "夜",
            KeyTimeEvent = "密钥失控"
        });
        await service.CreateTimelineAsync(new TimelineUpsertDto
        {
            ProjectId = project.Id,
            SourceBookId = "book-1",
            ChapterId = chapter1.Id,
            TimePeriod = "晨",
            KeyTimeEvent = "进入潮汐塔"
        });

        var rows = await service.ListTimelinesAsync(new TrackingListQuery { ProjectId = project.Id, SourceBookId = "book-1" });

        rows.Select(x => x.ChapterNumber).Should().Equal(1, 2);
        rows[0].ChapterTitle.Should().Be("第一章");
        rows[1].KeyTimeEvent.Should().Be("密钥失控");
    }

    [Fact]
    public async Task Completeness_reports_missing_and_ready_long_novel_elements()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;
        var project = new Project { Name = "长篇项目", CurrentSourceBookId = "book-1" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        var chapter = new Chapter { ProjectId = project.Id, VolumeId = volume.Id, ChapterNumber = 1, Title = "第一章", WordCount = 3200 };
        db.AddRange(project, volume, chapter);
        await db.SaveChangesAsync();
        var service = new NarrativeTrackingService(db);

        var empty = await service.GetCompletenessAsync(project.Id, "book-1");

        empty.IsReady.Should().BeFalse();
        empty.Items.Should().Contain(x => x.Key == "foreshadowings" && x.Status == "missing");
        empty.Items.Should().Contain(x => x.Key == "timeline" && x.Status == "missing");

        db.ChapterPlans.Add(new ChapterPlan { SourceBookId = "book-1", ChapterNumber = 1, ChapterTitle = "第一章", MainGoal = "进入潮汐塔" });
        await service.CreateForeshadowingAsync(new ForeshadowingUpsertDto { ProjectId = project.Id, SourceBookId = "book-1", Name = "密钥真相", Tier = "Tier-1" });
        await service.CreateTimelineAsync(new TimelineUpsertDto { ProjectId = project.Id, SourceBookId = "book-1", ChapterId = chapter.Id, TimePeriod = "晨", KeyTimeEvent = "进入潮汐塔" });
        await db.SaveChangesAsync();

        var ready = await service.GetCompletenessAsync(project.Id, "book-1");

        ready.Items.Should().Contain(x => x.Key == "foreshadowings" && x.Status == "ready");
        ready.Items.Should().Contain(x => x.Key == "timeline" && x.Status == "ready");
    }

    [Fact]
    public async Task RebuildTrackingAsync_replaces_foreshadowings_and_timelines_from_scene_blueprints()
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
            ChapterNumber = 8,
            Title = "第三潮汐塔暗门",
            Summary = "沈栀潜入第三潮汐塔。",
            WordCount = 3200
        };
        var staleForeshadowing = new Foreshadowing
        {
            ProjectId = project.Id,
            SourceBookId = "book-1",
            Name = "旧伏笔",
            Tier = "Tier-1"
        };
        var staleTimeline = new ChapterTimeline
        {
            ProjectId = project.Id,
            SourceBookId = "book-1",
            ChapterId = chapter.Id,
            TimePeriod = "旧时间",
            KeyTimeEvent = "旧事件"
        };
        var blueprint1 = new ChapterBlueprint
        {
            SourceBookId = "book-1",
            ChapterId = chapter.Id,
            SceneNumber = 1,
            SceneTitle = "入场",
            OneLineStructure = "沈栀进入第三潮汐塔暗门。",
            Cast = "伏笔：父亲声音的来源；职责：埋设",
            InfoDrop = "时间：深夜第三潮；地点：第三潮汐塔暗门；经过：距上一章一刻钟；时间线：沈栀正式进入潜入线。",
            Locations = "第三潮汐塔暗门"
        };
        var blueprint2 = new ChapterBlueprint
        {
            SourceBookId = "book-1",
            ChapterId = chapter.Id,
            SceneNumber = 2,
            SceneTitle = "回声",
            OneLineStructure = "父亲声音干扰沈栀判断。",
            Cast = "伏笔：父亲声音的来源；职责：推进",
            InfoDrop = "时间：深夜第三潮；地点：第三潮汐塔内环；时间线：父亲声音线索推进到可追踪状态。",
            Locations = "第三潮汐塔内环"
        };
        db.AddRange(project, volume, chapter, staleForeshadowing, staleTimeline, blueprint1, blueprint2);
        await db.SaveChangesAsync();
        var service = new NarrativeTrackingService(db);

        var result = await service.RebuildTrackingAsync(new TrackingRebuildRequest
        {
            ProjectId = project.Id,
            SourceBookId = "book-1"
        });

        result.ForeshadowingCount.Should().Be(1);
        result.TimelineCount.Should().Be(1);
        result.RemovedForeshadowingCount.Should().Be(1);
        result.RemovedTimelineCount.Should().Be(1);
        (await db.Foreshadowings.CountAsync()).Should().Be(1);
        (await db.ChapterTimelines.CountAsync()).Should().Be(1);
        var foreshadowing = await db.Foreshadowings.SingleAsync();
        foreshadowing.Name.Should().Be("父亲声音的来源");
        foreshadowing.IsSetup.Should().BeTrue();
        foreshadowing.ExpectedSetupChapter.Should().Be("第8章");
        foreshadowing.OverdueSuggestion.Should().Contain("入场");
        var timeline = await db.ChapterTimelines.SingleAsync();
        timeline.TimePeriod.Should().Be("深夜第三潮");
        timeline.ElapsedTime.Should().Be("距上一章一刻钟");
        timeline.KeyTimeEvent.Should().Contain("沈栀正式进入潜入线");
    }
}
