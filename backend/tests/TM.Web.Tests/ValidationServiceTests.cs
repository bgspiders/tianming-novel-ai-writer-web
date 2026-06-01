using FluentAssertions;
using TM.Web.Application.Dtos.Validation;
using TM.Web.Domain.Entities.Core;
using TM.Web.Domain.Entities.Design;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Domain.Entities.Tracking;
using TM.Web.Infrastructure.Services.Validation;
using Xunit;

namespace TM.Web.Tests;

public class ValidationServiceTests
{
    [Fact]
    public async Task RunAsync_persists_summary_and_chapter_reports()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var project = new Project { Name = "测试项目" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        var chapter = new Chapter
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterNumber = 1,
            Title = "第一章",
            Status = "drafted",
            ContentFilePath = "projects/p/chapters/c.md",
            WordCount = 1200
        };

        db.Projects.Add(project);
        db.Volumes.Add(volume);
        db.Chapters.Add(chapter);
        await db.SaveChangesAsync();

        var service = new ValidationService(db);
        var summary = await service.RunAsync(new ValidationRunRequest(project.Id, 1));

        summary.ProjectId.Should().Be(project.Id);
        summary.TargetVolumeNumber.Should().Be(1);
        summary.LastRunId.Should().NotBeNullOrWhiteSpace();
        summary.OverallResult.Should().Be("warning");

        var summaries = await service.ListSummariesAsync(project.Id, 1);
        var reports = await service.ListReportsAsync(project.Id, 1);

        summaries.Should().ContainSingle();
        reports.Should().ContainSingle();
        reports[0].RunId.Should().Be(summary.LastRunId);
        reports[0].Items.Should().Contain(i => i.Name == "章节标题" && i.Result == "passed");
        reports[0].Items.Should().Contain(i => i.Name == "章节规划" && i.Result == "warning");
    }

    [Fact]
    public async Task RunAsync_validates_planning_references_and_latest_run_reports()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var project = new Project { Name = "测试项目" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        var chapter = new Chapter
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterNumber = 1,
            Title = "第一章",
            Status = "drafted",
            ContentFilePath = "projects/p/chapters/c.md",
            WordCount = 1200
        };

        db.Projects.Add(project);
        db.Volumes.Add(volume);
        db.Chapters.Add(chapter);
        db.CharacterRules.Add(new CharacterRule { Name = "主角", IsEnabled = true });
        db.FactionRules.Add(new FactionRule { Name = "天命阁", IsEnabled = true });
        db.LocationRules.Add(new LocationRule { Name = "旧城", IsEnabled = true });
        db.ChapterPlans.Add(new ChapterPlan
        {
            Name = "第一章规划",
            ChapterNumber = 1,
            ReferencedCharacterNames = { "主角", "不存在的人" },
            ReferencedFactionNames = { "天命阁" },
            ReferencedLocationNames = { "旧城" }
        });
        db.ChapterBlueprints.Add(new ChapterBlueprint
        {
            Name = "第一章蓝图",
            ChapterId = chapter.Id,
            SceneNumber = 1,
            PovCharacter = "主角",
            Cast = "主角",
            Factions = "天命阁",
            Locations = "旧城"
        });
        db.PlotPoints.Add(new PlotPoint
        {
            ProjectId = project.Id,
            ChapterId = chapter.Id,
            Context = "主线推进",
            Importance = "high"
        });
        db.ChapterTimelines.Add(new ChapterTimeline
        {
            ProjectId = project.Id,
            ChapterId = chapter.Id,
            KeyTimeEvent = "入城",
            Importance = "normal"
        });
        db.CharacterMovements.Add(new CharacterMovement
        {
            ProjectId = project.Id,
            ChapterId = chapter.Id,
            CharacterName = "主角",
            FromLocation = "山门",
            ToLocation = "旧城"
        });
        await db.SaveChangesAsync();

        var service = new ValidationService(db);
        var firstSummary = await service.RunAsync(new ValidationRunRequest(project.Id, 1));
        var firstReport = (await service.ListReportsAsync(project.Id, 1)).Should().ContainSingle().Subject;

        firstSummary.OverallResult.Should().Be("failed");
        firstReport.Items.Should().Contain(i => i.Name == "引用角色" && i.Result == "failed");
        firstReport.Items.Should().Contain(i => i.Name == "章节规划" && i.Result == "passed");
        firstReport.Items.Should().Contain(i => i.Name == "剧情节点回写" && i.Result == "passed");

        db.CharacterRules.Add(new CharacterRule { Name = "不存在的人", IsEnabled = true });
        await db.SaveChangesAsync();

        var secondSummary = await service.RunAsync(new ValidationRunRequest(project.Id, 1));
        var latestReports = await service.ListReportsAsync(project.Id, 1);

        secondSummary.LastRunId.Should().NotBe(firstSummary.LastRunId);
        secondSummary.OverallResult.Should().Be("passed");
        latestReports.Should().ContainSingle();
        latestReports[0].RunId.Should().Be(secondSummary.LastRunId);
        latestReports[0].Items.Should().Contain(i => i.Name == "引用角色" && i.Result == "passed");
    }

    [Fact]
    public async Task RunAsync_marks_invalid_chapter_status_as_failed()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var project = new Project { Name = "测试项目" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        var chapter = new Chapter
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterNumber = 1,
            Title = "第一章",
            Status = "done",
            ContentFilePath = "projects/p/chapters/c.md",
            WordCount = 1200
        };

        db.Projects.Add(project);
        db.Volumes.Add(volume);
        db.Chapters.Add(chapter);
        await db.SaveChangesAsync();

        var service = new ValidationService(db);
        var summary = await service.RunAsync(new ValidationRunRequest(project.Id, 1));
        var report = (await service.ListReportsAsync(project.Id, 1)).Should().ContainSingle().Subject;

        summary.OverallResult.Should().Be("failed");
        report.Result.Should().Be("failed");
        report.Items.Should().Contain(i =>
            i.Name == "章节状态" &&
            i.Result == "failed" &&
            i.Details.Contains("done"));
    }

    [Fact]
    public async Task GetFactSnapshotAsync_returns_tracking_summary_sections()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var project = new Project { Name = "测试项目" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        var chapter = new Chapter
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterNumber = 3,
            Title = "第三章"
        };
        var character = new CharacterStateEntry
        {
            ProjectId = project.Id,
            CharacterId = "char-1",
            Name = "主角",
            StateHistory =
            {
                new CharacterStatePoint
                {
                    ChapterId = chapter.Id,
                    Phase = "破境",
                    Level = "筑基",
                    MentalState = "冷静",
                    KeyEvent = "识破陷阱",
                    Importance = "high"
                }
            }
        };
        var faction = new FactionStateEntry
        {
            ProjectId = project.Id,
            FactionId = "faction-1",
            Name = "天命阁",
            CurrentStatus = "active",
            StateHistory =
            {
                new FactionStatePoint
                {
                    ChapterId = chapter.Id,
                    Status = "交锋",
                    Event = "夺取线索",
                    Importance = "normal"
                }
            }
        };
        var location = new LocationStateEntry
        {
            ProjectId = project.Id,
            LocationId = "location-1",
            Name = "旧城",
            CurrentStatus = "normal",
            StateHistory =
            {
                new LocationStatePoint
                {
                    ChapterId = chapter.Id,
                    Status = "封锁",
                    Event = "阵法启动",
                    Importance = "high"
                }
            }
        };
        var conflict = new ConflictProgressEntry
        {
            ProjectId = project.Id,
            Name = "黑匣子争夺",
            Status = "active",
            Type = "main",
            Tier = "Tier-1",
            ProgressPoints =
            {
                new ConflictProgressPoint
                {
                    ChapterId = chapter.Id,
                    Status = "升级",
                    Event = "双方正面交锋",
                    Importance = "high"
                }
            }
        };
        var item = new ItemStateEntry
        {
            ProjectId = project.Id,
            Name = "黑匣子",
            CurrentHolder = "主角",
            CurrentStatus = "active",
            StateHistory =
            {
                new ItemStatePoint
                {
                    ChapterId = chapter.Id,
                    Holder = "主角",
                    Status = "obtained",
                    Event = "主角取得黑匣子",
                    Importance = "high"
                }
            }
        };

        db.Projects.Add(project);
        db.Volumes.Add(volume);
        db.Chapters.Add(chapter);
        db.CharacterStateEntries.Add(character);
        db.CharacterRules.Add(new CharacterRule
        {
            Name = "主角",
            CharacterType = "主角",
            Appearance = "黑衣少年",
            IsEnabled = true
        });
        db.FactionStateEntries.Add(faction);
        db.LocationStateEntries.Add(location);
        db.LocationRules.Add(new LocationRule
        {
            Name = "旧城",
            LocationType = "城池",
            Terrain = "废墟",
            IsEnabled = true
        });
        db.WorldRules.Add(new WorldRule
        {
            Name = "修行体系",
            HardRules = "破境必须经历雷劫；法器不可凭空认主",
            IsEnabled = true
        });
        db.ConflictProgressEntries.Add(conflict);
        db.CharacterLocations.Add(new CharacterLocation
        {
            ProjectId = project.Id,
            CharacterName = "主角",
            CurrentLocation = "旧城",
            LastUpdatedChapter = chapter.Id
        });
        db.CharacterMovements.Add(new CharacterMovement
        {
            ProjectId = project.Id,
            CharacterName = "主角",
            ChapterId = chapter.Id,
            FromLocation = "山门",
            ToLocation = "旧城",
            Importance = "high"
        });
        db.ItemStateEntries.Add(item);
        db.ChapterTimelines.Add(new ChapterTimeline
        {
            ProjectId = project.Id,
            ChapterId = chapter.Id,
            TimePeriod = "夜晚",
            ElapsedTime = "三日后",
            KeyTimeEvent = "阵法启动",
            Importance = "high"
        });
        db.Foreshadowings.Add(new Foreshadowing
        {
            ProjectId = project.Id,
            Name = "黑匣子",
            IsSetup = true,
            IsResolved = false,
            IsOverdue = true,
            Tier = "Tier-1"
        });
        db.PlotPoints.Add(new PlotPoint
        {
            ProjectId = project.Id,
            ChapterId = chapter.Id,
            Context = "主角发现黑匣子",
            Importance = "high",
            Storyline = "main"
        });
        await db.SaveChangesAsync();

        var service = new ValidationService(db);
        var snapshot = await service.GetFactSnapshotAsync(project.Id, 1);

        snapshot.Overview.CharacterStateCount.Should().Be(1);
        snapshot.Overview.CharacterDescriptionCount.Should().Be(1);
        snapshot.Overview.ConflictProgressCount.Should().Be(1);
        snapshot.Overview.ConflictProgressPointCount.Should().Be(1);
        snapshot.Overview.FactionStateCount.Should().Be(1);
        snapshot.Overview.LocationStateCount.Should().Be(1);
        snapshot.Overview.LocationDescriptionCount.Should().Be(1);
        snapshot.Overview.WorldRuleConstraintCount.Should().Be(2);
        snapshot.Overview.CharacterLocationCount.Should().Be(1);
        snapshot.Overview.CharacterMovementCount.Should().Be(1);
        snapshot.Overview.ItemStateCount.Should().Be(1);
        snapshot.Overview.ItemStatePointCount.Should().Be(1);
        snapshot.Overview.TimelineCount.Should().Be(1);
        snapshot.Overview.ForeshadowingCount.Should().Be(1);
        snapshot.Overview.OverdueForeshadowingCount.Should().Be(1);
        snapshot.Overview.PlotPointCount.Should().Be(1);
        snapshot.Sections.Should().HaveCount(12);
        snapshot.Sections.Select(s => s.Key).Should().Contain(new[]
        {
            "characterStates",
            "characterDescriptions",
            "conflictProgress",
            "factionStates",
            "locationStates",
            "locationDescriptions",
            "worldRuleConstraints",
            "characterLocations",
            "itemStates",
            "foreshadowings",
            "timeline",
            "plotPoints"
        });
    }

    [Fact]
    public async Task UpdateReportChapterStatusAsync_marks_chapter_fix_state()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var project = new Project { Name = "测试项目" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        var chapter = new Chapter
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterNumber = 1,
            Title = "第一章",
            Status = "drafted",
            ContentFilePath = "projects/p/chapters/c.md",
            WordCount = 1200
        };

        db.Projects.Add(project);
        db.Volumes.Add(volume);
        db.Chapters.Add(chapter);
        await db.SaveChangesAsync();

        var service = new ValidationService(db);
        await service.RunAsync(new ValidationRunRequest(project.Id, 1));
        var report = (await service.ListReportsAsync(project.Id, 1)).Should().ContainSingle().Subject;

        var result = await service.UpdateReportChapterStatusAsync(
            report.Id,
            new ValidationReportStatusUpdateRequest("needs_fix", "人工复核"));

        result.ChapterId.Should().Be(chapter.Id);
        result.ChapterStatus.Should().Be("needs_fix");
        (await db.Chapters.FindAsync(chapter.Id))!.Status.Should().Be("needs_fix");

        var updatedReport = (await service.ListReportsAsync(project.Id, 1)).Should().ContainSingle().Subject;
        updatedReport.ChapterStatus.Should().Be("needs_fix");
    }
}
