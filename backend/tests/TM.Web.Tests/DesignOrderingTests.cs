using FluentAssertions;
using TM.Web.Application.Dtos.Design;
using TM.Web.Domain.Entities.Core;
using TM.Web.Domain.Entities.Design;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Infrastructure.Services.Design;
using Xunit;

namespace TM.Web.Tests;

public class DesignOrderingTests
{
    [Fact]
    public async Task Volume_designs_are_ordered_by_volume_and_chapter_range_before_paging()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        db.VolumeDesigns.AddRange(
            new VolumeDesign { Name = "第三卷", VolumeNumber = 3, StartChapter = 21, VolumeTitle = "后段", UpdatedAt = DateTime.UtcNow.AddMinutes(3) },
            new VolumeDesign { Name = "第一卷", VolumeNumber = 1, StartChapter = 1, VolumeTitle = "开局", UpdatedAt = DateTime.UtcNow.AddMinutes(1) },
            new VolumeDesign { Name = "第二卷", VolumeNumber = 2, StartChapter = 11, VolumeTitle = "中段", UpdatedAt = DateTime.UtcNow.AddMinutes(2) });
        await db.SaveChangesAsync();

        var service = new VolumeDesignService(db);
        var page = await service.ListPagedAsync(new DesignListQuery(Page: 1, PageSize: 2));

        page.Items.Select(x => x.VolumeNumber).Should().Equal(1, 2);
    }

    [Fact]
    public async Task Plot_rules_are_ordered_by_volume_and_step_title_before_paging()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        db.PlotRules.AddRange(
            new PlotRule { Name = "第三事件", TargetVolume = "3", AssignedVolume = "3", StepTitle = "03", UpdatedAt = DateTime.UtcNow.AddMinutes(3) },
            new PlotRule { Name = "第一事件", TargetVolume = "1", AssignedVolume = "1", StepTitle = "01", UpdatedAt = DateTime.UtcNow.AddMinutes(1) },
            new PlotRule { Name = "第二事件", TargetVolume = "2", AssignedVolume = "2", StepTitle = "02", UpdatedAt = DateTime.UtcNow.AddMinutes(2) });
        await db.SaveChangesAsync();

        var service = new PlotRuleService(db);
        var page = await service.ListPagedAsync(new DesignListQuery(Page: 1, PageSize: 2));

        page.Items.Select(x => x.Name).Should().Equal("第一事件", "第二事件");
    }

    [Fact]
    public async Task Dictionary_rules_are_ordered_by_category_and_name_before_paging()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        db.CharacterRules.AddRange(
            new CharacterRule { Name = "C 赵乙", Category = "配角", UpdatedAt = DateTime.UtcNow.AddMinutes(3) },
            new CharacterRule { Name = "A 沈甲", Category = "主角", UpdatedAt = DateTime.UtcNow.AddMinutes(1) },
            new CharacterRule { Name = "B 林丙", Category = "主角", UpdatedAt = DateTime.UtcNow.AddMinutes(2) });
        await db.SaveChangesAsync();

        var service = new CharacterRuleService(db);
        var page = await service.ListPagedAsync(new DesignListQuery(Page: 1, PageSize: 2));

        page.Items.Select(x => x.Name).Should().Equal("A 沈甲", "B 林丙");
    }

    [Fact]
    public async Task Chapter_blueprints_use_sqlite_safe_chapter_ordering()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var project = new Project { Name = "排序项目" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        var chapter3 = new Chapter { ProjectId = project.Id, VolumeId = volume.Id, ChapterNumber = 3, Title = "第三章" };
        var chapter1 = new Chapter { ProjectId = project.Id, VolumeId = volume.Id, ChapterNumber = 1, Title = "第一章" };
        var chapter2 = new Chapter { ProjectId = project.Id, VolumeId = volume.Id, ChapterNumber = 2, Title = "第二章" };
        db.Projects.Add(project);
        db.Volumes.Add(volume);
        db.Chapters.AddRange(chapter3, chapter1, chapter2);
        db.ChapterBlueprints.AddRange(
            new ChapterBlueprint { Name = "第三章蓝图", ChapterId = chapter3.Id, SceneNumber = 1, UpdatedAt = DateTime.UtcNow.AddMinutes(3) },
            new ChapterBlueprint { Name = "第一章蓝图", ChapterId = chapter1.Id, SceneNumber = 1, UpdatedAt = DateTime.UtcNow.AddMinutes(1) },
            new ChapterBlueprint { Name = "第二章蓝图", ChapterId = chapter2.Id, SceneNumber = 1, UpdatedAt = DateTime.UtcNow.AddMinutes(2) });
        await db.SaveChangesAsync();

        var service = new ChapterBlueprintService(db);
        var page = await service.ListPagedAsync(new DesignListQuery(Page: 1, PageSize: 2));

        page.Items.Select(x => x.Name).Should().Equal("第一章蓝图", "第二章蓝图");
    }
}
