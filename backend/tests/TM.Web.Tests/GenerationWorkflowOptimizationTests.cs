using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using TM.Web.Application.Dtos;
using TM.Web.Application.Dtos.Ai;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Dtos.Recall;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Global;
using TM.Web.Domain.Entities.Core;
using TM.Web.Domain.Entities.Design;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Domain.Entities.Tracking;
using TM.Web.Infrastructure.Services.Generation;
using Xunit;

namespace TM.Web.Tests;

public class GenerationWorkflowOptimizationTests
{
    [Fact]
    public async Task PreflightAsync_marks_missing_scene_blueprints_as_fatal()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var project = new Project { Name = "长篇项目" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        var chapter = new Chapter
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterNumber = 1,
            Title = "第一章",
            Status = "planned"
        };
        var plan = new ChapterPlan
        {
            ChapterNumber = 1,
            ChapterTitle = "第一章",
            MainGoal = "开局",
            CoreEvent = "主角登场"
        };
        db.AddRange(project, volume, chapter, plan);
        await db.SaveChangesAsync();

        var service = new GenerationPreflightService(db);

        var result = await service.CheckAsync(new GenerationPreflightRequest
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterId = chapter.Id,
            RequireSceneBlueprints = true
        });

        result.Passed.Should().BeFalse();
        result.FatalCount.Should().Be(1);
        result.Items.Should().Contain(x => x.Code == "missing_scene_blueprints" && x.Severity == "fatal");
        db.GenerationPreflightReports.Should().ContainSingle(x => x.ChapterId == chapter.Id && !x.Passed);
    }

    [Fact]
    public async Task EnsureSceneBlueprintsAsync_creates_default_scenes_and_clears_preflight_fatal()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var project = new Project { Name = "长篇项目", CurrentSourceBookId = "book-a" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        var chapter = new Chapter
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterNumber = 6,
            Title = "第6章 潮汐塔暗门",
            Summary = "沈栀准备潜入第三潮汐塔。",
            Status = "planned"
        };
        var plan = new ChapterPlan
        {
            SourceBookId = "book-a",
            ChapterNumber = 6,
            ChapterTitle = "潮汐塔暗门",
            MainGoal = "沈栀进入第三潮汐塔",
            ResistanceSource = "潮汐财团巡检",
            KeyTurn = "暗门坐标失效",
            Hook = "塔内传来父亲声音",
            ForeshadowingRole = "推进",
            Foreshadowing = "父亲声音的来源",
            TemporalAnchor = "深夜第三潮",
            SpatialAnchor = "第三潮汐塔暗门",
            TimelineCoordinate = "卷1/章6/潜入开始",
            ReferencedCharacterNames = new() { "沈栀" },
            ReferencedFactionNames = new() { "潮汐财团" },
            ReferencedLocationNames = new() { "第三潮汐塔" }
        };
        db.AddRange(project, volume, chapter, plan);
        await db.SaveChangesAsync();

        var service = new GenerationPreflightService(db);

        var created = await service.EnsureSceneBlueprintsAsync(new EnsureSceneBlueprintsRequest
        {
            ProjectId = project.Id,
            ChapterId = chapter.Id
        });
        var preflight = await service.CheckAsync(new GenerationPreflightRequest
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterId = chapter.Id,
            RequireSceneBlueprints = true
        });

        created.CreatedCount.Should().Be(3);
        created.Scenes.Select(x => x.SceneNumber).Should().Equal(1, 2, 3);
        db.ChapterBlueprints.Should().HaveCount(3);
        db.ChapterBlueprints.Should().OnlyContain(x => x.ChapterId == chapter.Id && x.SourceBookId == "book-a");
        db.ChapterBlueprints.Should().OnlyContain(x => x.Cast.Contains("父亲声音的来源"));
        db.ChapterBlueprints.Should().OnlyContain(x => x.InfoDrop.Contains("深夜第三潮"));
        db.ChapterBlueprints.Should().OnlyContain(x => x.Locations == "第三潮汐塔暗门");
        preflight.Items.Should().NotContain(x => x.Code == "missing_scene_blueprints");
    }

    [Fact]
    public async Task ConfirmPreviewAsync_updates_chapter_and_upserts_scene_blueprints()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var project = new Project { Name = "长篇项目", CurrentSourceBookId = "book-a" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        var chapter = new Chapter
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterNumber = 9,
            Title = "第9章 待生成",
            Summary = "",
            Status = "planned"
        };
        db.AddRange(project, volume, chapter);
        await db.SaveChangesAsync();

        var service = new GenerationPreflightService(db);
        var result = await service.ConfirmPreviewAsync(new ConfirmChapterGenerationPreviewRequest
        {
            ProjectId = project.Id,
            ChapterId = chapter.Id,
            Preview = new ChapterBatchGenerationPreviewItemDto
            {
                ChapterNumber = 9,
                Title = "买下一座废厂",
                Summary = "白葛用废厂建立第一块基地。",
                Scenes = new()
                {
                    new ChapterBatchGenerationScenePreviewDto
                    {
                        SceneNumber = 1,
                        Title = "入场",
                        Summary = "买厂谈判开始。",
                        Goal = "明确买厂目标。",
                        Conflict = "卖方临时抬价。",
                        Hook = "废厂地下传出异响。",
                        ForeshadowingName = "地下翡翠矿脉",
                        ForeshadowingRole = "埋设",
                        TimeAnchor = "第9章上午",
                        LocationAnchor = "旧废厂办公室",
                        ElapsedFromPrevious = "距上一章次日清晨",
                        TimelineEffect = "白葛正式获得废厂线索入口。"
                    },
                    new ChapterBatchGenerationScenePreviewDto
                    {
                        SceneNumber = 2,
                        Title = "交锋",
                        Summary = "资金和手续压力爆发。",
                        Goal = "完成关键谈判。",
                        Conflict = "代理人阻挠。",
                        Hook = "系统识别旧防空掩体。"
                    },
                    new ChapterBatchGenerationScenePreviewDto
                    {
                        SceneNumber = 3,
                        Title = "钩子",
                        Summary = "拿下废厂并发现地下线索。",
                        Goal = "收束本章成果。",
                        Conflict = "新危机出现。",
                        Hook = "墙体里露出翡翠矿化痕迹。",
                        ForeshadowingName = "地下翡翠矿脉",
                        ForeshadowingRole = "推进",
                        TimeAnchor = "第9章午后",
                        LocationAnchor = "废厂地下墙体",
                        ElapsedFromPrevious = "谈判后两小时",
                        TimelineEffect = "废厂地下线索被推进到可探索状态。"
                    }
                }
            }
        });

        var updated = await db.Chapters.AsNoTracking().FirstAsync(x => x.Id == chapter.Id);
        var blueprints = await db.ChapterBlueprints.AsNoTracking()
            .Where(x => x.ChapterId == chapter.Id)
            .OrderBy(x => x.SceneNumber)
            .ToListAsync();

        result.Title.Should().Be("买下一座废厂");
        result.SceneCount.Should().Be(3);
        updated.Title.Should().Be("买下一座废厂");
        updated.Summary.Should().Be("白葛用废厂建立第一块基地。");
        updated.Status.Should().Be("blueprinted");
        blueprints.Should().HaveCount(3);
        blueprints[0].Cast.Should().Contain("地下翡翠矿脉");
        blueprints[0].Locations.Should().Be("旧废厂办公室");
        blueprints[0].InfoDrop.Should().Contain("第9章上午");
        blueprints[1].SceneTitle.Should().Be("交锋");
        blueprints[1].Development.Should().Be("代理人阻挠。");
        blueprints[2].Ending.Should().Be("墙体里露出翡翠矿化痕迹。");
        blueprints[2].Cast.Should().Contain("推进");
        db.Foreshadowings.Should().ContainSingle(x =>
            x.ProjectId == project.Id
            && x.Name == "地下翡翠矿脉"
            && x.IsSetup);
        db.ChapterTimelines.Should().ContainSingle(x =>
            x.ProjectId == project.Id
            && x.ChapterId == chapter.Id
            && x.TimePeriod == "第9章上午"
            && x.KeyTimeEvent.Contains("白葛正式获得废厂线索入口"));
    }

    [Fact]
    public async Task GenerateSceneDraftAsync_uses_blueprint_and_persists_scene_record()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var project = new Project { Name = "长篇项目" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        var chapter = new Chapter
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterNumber = 2,
            Title = "第二章",
            Status = "planned"
        };
        var blueprint = new ChapterBlueprint
        {
            ChapterId = chapter.Id,
            SceneNumber = 1,
            SceneTitle = "潜入塔底",
            Opening = "主角进入第三潮汐塔",
            Development = "躲过巡逻",
            Turning = "发现密门",
            Ending = "留下悬念",
            Cast = "沈栀",
            Locations = "第三潮汐塔"
        };
        db.AddRange(project, volume, chapter, blueprint);
        await db.SaveChangesAsync();

        var ai = new CapturingAiCompletionService("场景正文：沈栀进入第三潮汐塔。");
        using var storage = new TempStorage();
        var service = new SceneGenerationService(
            db,
            ai,
            new FakeAiApiKeyService(),
            new ContextPackagingService(db, storage.Configuration),
            storage.Configuration,
            NullLogger<SceneGenerationService>.Instance);

        var result = await service.GenerateSceneDraftAsync(new SceneDraftRequest
        {
            RunId = "scene-run-1",
            ProjectId = project.Id,
            ChapterId = chapter.Id,
            SceneNumber = 1,
            Endpoint = "https://example.invalid/v1/chat/completions",
            ApiKey = "test-key",
            Model = "test-model",
            Prompt = "写这个场景"
        });

        result.SceneTitle.Should().Be("潜入塔底");
        result.Content.Should().Contain("第三潮汐塔");
        ai.CapturedPrompt.Should().Contain("# P0 核心上下文");
        ai.CapturedPrompt.Should().Contain("潜入塔底");
        ai.CapturedPrompt.Should().Contain("主角进入第三潮汐塔");
        db.SceneGenerationRecords.Should().ContainSingle(x =>
            x.ChapterId == chapter.Id && x.SceneNumber == 1 && x.Success && x.Content.Contains("沈栀"));
        db.PromptRunSnapshots.Should().ContainSingle(x =>
            x.RunId == "scene-run-1"
            && x.ProjectId == project.Id
            && x.ChapterId == chapter.Id
            && x.ContextHash.Length == 64
            && x.OutputSummary.Contains("沈栀"));
    }

    [Fact]
    public async Task BatchPreviewAsync_includes_scene_blueprints_from_chapter_plan()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var project = new Project { Name = "长篇项目", CurrentSourceBookId = "book-a" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        var plan = new ChapterPlan
        {
            SourceBookId = "book-a",
            ChapterNumber = 8,
            ChapterTitle = "第三潮汐塔暗门",
            MainGoal = "沈栀进入第三潮汐塔",
            ResistanceSource = "潮汐财团巡检",
            KeyTurn = "暗门坐标失效",
            Hook = "塔内传来父亲声音",
            MainPlotProgress = "沈栀开始真正潜入第三潮汐塔",
            ForeshadowingTier = "Tier-2",
            ForeshadowingRole = "推进",
            Foreshadowing = "父亲声音的来源",
            TemporalAnchor = "深夜第三潮",
            SpatialAnchor = "第三潮汐塔暗门",
            TimelineCoordinate = "卷1/章8/潜入中"
        };
        db.AddRange(project, volume, plan);
        await db.SaveChangesAsync();

        var items = await ChapterBatchGenerationWorker.BuildPreviewAsync(db, new ChapterBatchGenerationPreviewRequest
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            StartChapterNumber = 8,
            Count = 1,
            CreateMissing = true
        }, CancellationToken.None);

        items.Should().ContainSingle();
        items[0].Title.Should().Be("第三潮汐塔暗门");
        items[0].Scenes.Should().HaveCount(3);
        items[0].Scenes.Select(x => x.Title).Should().OnlyContain(x => x.Contains("第三潮汐塔暗门"));
        items[0].Scenes[1].Conflict.Should().Contain("潮汐财团巡检");
        items[0].Scenes.Should().OnlyContain(x => x.ForeshadowingName == "父亲声音的来源");
        items[0].Scenes.Should().OnlyContain(x => x.TimeAnchor == "深夜第三潮");
        items[0].Scenes.Should().OnlyContain(x => x.LocationAnchor == "第三潮汐塔暗门");
        items[0].Scenes[0].TimelineEffect.Should().Contain("卷1/章8/潜入中");
    }

    [Fact]
    public async Task BuildGenerationContextAsync_packages_p0_to_p3_context()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var project = new Project { Name = "长篇项目", CurrentSourceBookId = "book-a" };
        var volume = new Volume
        {
            ProjectId = project.Id,
            VolumeNumber = 1,
            Title = "潮汐卷",
            Theme = "潜入与觉醒",
            MilestoneText = "本卷目标：进入第三潮汐塔并揭开财团实验。"
        };
        var previousChapter = new Chapter
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterNumber = 1,
            Title = "旧塔回声",
            Summary = "沈栀发现潮汐塔暗门。",
            ContentFilePath = "projects/p/chapters/001.md",
            Status = "drafted"
        };
        var currentChapter = new Chapter
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterNumber = 2,
            Title = "第三潮汐塔",
            Summary = "当前章节",
            Status = "planned"
        };
        var plan = new ChapterPlan
        {
            SourceBookId = "book-a",
            ChapterNumber = 2,
            ChapterTitle = "第三潮汐塔",
            MainGoal = "潜入第三潮汐塔",
            CoreEvent = "沈栀盗取潮汐档案",
            MacroPhase = "第一阶段",
            Hook = "档案指向失踪父亲",
            ReferencedCharacterNames = new() { "沈栀" },
            ReferencedFactionNames = new() { "潮汐财团" },
            ReferencedLocationNames = new() { "第三潮汐塔" }
        };
        var blueprint = new ChapterBlueprint
        {
            SourceBookId = "book-a",
            ChapterId = currentChapter.Id,
            SceneNumber = 1,
            SceneTitle = "潜入塔底",
            Opening = "沈栀进入第三潮汐塔",
            Cast = "沈栀",
            Locations = "第三潮汐塔"
        };
        var character = new CharacterRule
        {
            SourceBookId = "book-a",
            Name = "沈栀",
            Category = "主角",
            Identity = "被财团通缉的潜入者",
            Want = "找回父亲失踪真相",
            Need = "学会信任盟友",
            CombatSkills = "潮汐感知"
        };
        var stateEntry = new CharacterStateEntry
        {
            ProjectId = project.Id,
            SourceBookId = "book-a",
            CharacterId = character.Id,
            Name = "沈栀",
            BaseProfile = "冷静、偏执，正在潜入潮汐财团"
        };
        var world = new WorldRule
        {
            SourceBookId = "book-a",
            Name = "潮汐塔规则",
            OneLineSummary = "潮汐塔会记录进入者记忆。",
            HardRules = "不能绕过塔内记忆审计。"
        };
        var foreshadowing = new Foreshadowing
        {
            ProjectId = project.Id,
            SourceBookId = "book-a",
            Name = "失踪父亲档案",
            Tier = "Tier-1",
            IsSetup = true,
            IsResolved = false,
            ExpectedPayoffChapter = "第5章"
        };

        db.AddRange(project, volume, previousChapter, currentChapter, plan, blueprint, character, stateEntry, world, foreshadowing);
        await db.SaveChangesAsync();

        using var storage = new TempStorage();
        storage.Write(previousChapter.ContentFilePath, "前文很多内容。\n上一章结尾：沈栀把潮汐塔暗门的坐标刻在掌心。");
        var service = new ContextPackagingService(
            db,
            storage.Configuration,
            new FakeChapterRecallService(new ChapterRecallResponseDto(
                currentChapter.Id,
                "沈栀 潮汐财团 第三潮汐塔",
                "chapter-context",
                3,
                new[]
                {
                    new ChapterRecallResultDto(
                        previousChapter.Id,
                        previousChapter.Title,
                        previousChapter.ChapterNumber,
                        previousChapter.VolumeId,
                        previousChapter.Summary,
                        9.4,
                        new[] { "沈栀", "潮汐塔" },
                        "关键词命中：沈栀、潮汐塔")
                })));

        var result = await service.BuildGenerationContextAsync(new GenerationContextRequest
        {
            ProjectId = project.Id,
            ChapterId = currentChapter.Id,
            SceneNumber = 1
        });

        result.ContextText.Should().Contain("# P0 核心上下文");
        result.ContextText.Should().Contain("潜入第三潮汐塔");
        result.ContextText.Should().Contain("# P1 重要上下文");
        result.ContextText.Should().Contain("本卷目标：进入第三潮汐塔");
        result.ContextText.Should().Contain("上一章结尾：沈栀把潮汐塔暗门的坐标刻在掌心");
        result.ContextText.Should().Contain("沈栀：冷静、偏执");
        result.ContextText.Should().Contain("# P2 召回与伏笔上下文");
        result.ContextText.Should().Contain("相关记忆 Top-K");
        result.ContextText.Should().Contain("第1章《旧塔回声》");
        result.ContextText.Should().Contain("关键词命中：沈栀、潮汐塔");
        result.ContextText.Should().Contain("失踪父亲档案");
        result.ContextText.Should().Contain("# P3 风格与规则上下文");
        result.ContextText.Should().Contain("潮汐塔会记录进入者记忆");
        result.Sections.Select(x => x.Level).Should().Contain(new[] { "P0", "P1", "P2", "P3" });
    }

    [Fact]
    public async Task AnalyzeChapterAsync_flags_short_content_and_persists_report()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var project = new Project { Name = "长篇项目" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        using var storage = new TempStorage();
        var chapter = new Chapter
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterNumber = 3,
            Title = "第三章",
            Summary = "旧摘要",
            ContentFilePath = "projects/p/chapters/003.md",
            WordCount = 3,
            Status = "drafted"
        };
        storage.Write(chapter.ContentFilePath, "太短了");
        db.AddRange(project, volume, chapter);
        await db.SaveChangesAsync();

        var service = new ChapterAnalysisService(db, storage.Configuration);

        var result = await service.AnalyzeAsync(new ChapterAnalysisRequest
        {
            ProjectId = project.Id,
            ChapterId = chapter.Id,
            MinWordCount = 100,
            UpdateChapterSummary = true
        });

        result.Passed.Should().BeFalse();
        result.ShouldPauseBatch.Should().BeTrue();
        result.Items.Should().Contain(x => x.Code == "chapter_too_short" && x.Severity == "fatal");
        db.ChapterAnalysisReports.Should().ContainSingle(x => x.ChapterId == chapter.Id && !x.Passed);
    }

    [Fact]
    public async Task AnalyzeChapterAsync_flags_scene_locked_fact_hook_and_repetition_issues()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var project = new Project { Name = "长篇项目", CurrentSourceBookId = "book-a" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        using var storage = new TempStorage();
        var chapter = new Chapter
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterNumber = 4,
            Title = "第四章",
            Summary = "旧摘要",
            ContentFilePath = "projects/p/chapters/004.md",
            Status = "drafted"
        };
        var blueprint = new ChapterBlueprint
        {
            SourceBookId = "book-a",
            ChapterId = chapter.Id,
            SceneNumber = 1,
            SceneTitle = "潜入塔底",
            Opening = "沈栀进入第三潮汐塔",
            InfoDrop = "父亲档案编号T-17"
        };
        db.AddRange(project, volume, chapter, blueprint, new AppSetting
        {
            Key = $"tianming.kb.{project.Id}.book-a.archive_events",
            Value = "- 锁定事实：沈栀必须发现父亲档案编号T-17"
        });
        await db.SaveChangesAsync();
        storage.Write(chapter.ContentFilePath, string.Join('\n', new[]
        {
            "沈栀走进旧街，听见远处潮声。",
            "沈栀走进旧街，听见远处潮声。",
            "她没有进入塔底，也没有发现档案。",
            "事情暂时结束。"
        }));

        var service = new ChapterAnalysisService(db, storage.Configuration);

        var result = await service.AnalyzeAsync(new ChapterAnalysisRequest
        {
            ProjectId = project.Id,
            ChapterId = chapter.Id,
            MinWordCount = 1
        });

        result.Passed.Should().BeFalse();
        result.ShouldPauseBatch.Should().BeTrue();
        result.Items.Should().Contain(x => x.Code == "scene_blueprint_not_grounded");
        result.Items.Should().Contain(x => x.Code == "locked_fact_missing");
        result.Items.Should().Contain(x => x.Code == "ending_hook_missing");
        result.Items.Should().Contain(x => x.Code == "repeated_paragraph");
    }

    [Fact]
    public async Task AnalyzeChapterAsync_does_not_require_generic_scene_title_suffix_as_grounding_anchor()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var project = new Project { Name = "长篇项目", CurrentSourceBookId = "book-a" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        var chapter = new Chapter
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterNumber = 3,
            Title = "买下一座废厂",
            Summary = "白葛来到旧工业区，准备买下一座废厂。他与中介谈判，确认厂区仓库和水电线路，最终拿下厂房钥匙！",
            Status = "drafted"
        };
        var blueprint = new ChapterBlueprint
        {
            SourceBookId = "book-a",
            ChapterId = chapter.Id,
            SceneNumber = 1,
            SceneTitle = "买下一座废厂·入场",
            Opening = "白葛进入旧工业区准备买厂",
            Development = "中介抬价，废厂手续存在隐患",
            Turning = "白葛用现金和后续改造计划压住价格",
            Ending = "白葛拿到厂房钥匙",
            InfoDrop = "地点：旧工业区；时间线：白葛取得废厂控制权",
            Locations = "旧工业区"
        };
        db.AddRange(project, volume, chapter, blueprint);
        await db.SaveChangesAsync();

        var service = new ChapterAnalysisService(db, new ConfigurationBuilder().Build());

        var result = await service.AnalyzeAsync(new ChapterAnalysisRequest
        {
            ProjectId = project.Id,
            ChapterId = chapter.Id,
            MinWordCount = 0
        });

        result.Items.Should().NotContain(x => x.Code == "scene_blueprint_not_grounded");
    }

    [Fact]
    public async Task AnalyzeChapterAsync_requires_scene_foreshadowing_and_timeline_anchors()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var project = new Project { Name = "长篇项目", CurrentSourceBookId = "book-a" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        using var storage = new TempStorage();
        var chapter = new Chapter
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            ChapterNumber = 9,
            Title = "买下一座废厂",
            Summary = "白葛用废厂建立第一块基地。",
            ContentFilePath = "projects/p/chapters/009.md",
            Status = "drafted"
        };
        var blueprint = new ChapterBlueprint
        {
            SourceBookId = "book-a",
            ChapterId = chapter.Id,
            SceneNumber = 1,
            SceneTitle = "入场",
            Opening = "白葛走进旧废厂办公室",
            Development = "卖方临时抬价",
            Turning = "买厂谈判开始",
            Ending = "废厂地下传出异响",
            InfoDrop = "买厂谈判开始；时间：第9章上午；地点：旧废厂办公室；经过：距上一章次日清晨；时间线：白葛正式获得废厂线索入口。",
            Cast = "伏笔：地下翡翠矿脉；职责：埋设",
            Locations = "旧废厂办公室"
        };
        db.AddRange(project, volume, chapter, blueprint);
        await db.SaveChangesAsync();
        storage.Write(chapter.ContentFilePath, string.Join('\n', new[]
        {
            "第9章 买下一座废厂",
            "第9章上午，白葛走进旧废厂办公室，卖方临时抬价，买厂谈判开始。",
            "距上一章次日清晨，他正式获得废厂线索入口，却没有察觉地下真正藏着什么。",
            "门外忽然传来一声闷响，旧废厂办公室的灯全部灭了！"
        }));

        var service = new ChapterAnalysisService(db, storage.Configuration);

        var result = await service.AnalyzeAsync(new ChapterAnalysisRequest
        {
            ProjectId = project.Id,
            ChapterId = chapter.Id,
            MinWordCount = 1
        });

        result.Passed.Should().BeFalse();
        result.Items.Should().Contain(x =>
            x.Code == "scene_foreshadowing_missing"
            && x.Severity == "fatal"
            && x.Message.Contains("地下翡翠矿脉"));
        result.Items.Should().NotContain(x => x.Code == "scene_time_anchor_missing");
        result.Items.Should().NotContain(x => x.Code == "scene_location_anchor_missing");
    }

    private sealed class CapturingAiCompletionService : IAiCompletionService
    {
        private readonly string _content;

        public CapturingAiCompletionService(string content)
        {
            _content = content;
        }

        public string CapturedPrompt { get; private set; } = string.Empty;

        public Task<AiTestResult> StreamAsync(AiTestRequest request, CancellationToken ct = default)
            => CompleteAsync(request, ct);

        public Task<AiTestResult> CompleteAsync(AiTestRequest request, CancellationToken ct = default)
        {
            CapturedPrompt = request.Prompt;
            return Task.FromResult(new AiTestResult
            {
                RunId = request.RunId,
                Model = request.Model,
                Content = _content,
                CharCount = _content.Length,
                ChunkCount = 1,
                FinishReason = "stop",
                ElapsedMs = 1
            });
        }
    }

    private sealed class FakeAiApiKeyService : IAiApiKeyService
    {
        public Task<IReadOnlyList<AiApiKeyDto>> ListAsync(string? providerId, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<AiApiKeyDto>>(Array.Empty<AiApiKeyDto>());

        public Task<AiApiKeyDto?> GetAsync(string id, CancellationToken ct = default)
            => Task.FromResult<AiApiKeyDto?>(null);

        public Task<AiApiKeyDto> CreateAsync(AiApiKeyCreateDto input, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task<AiApiKeyDto> UpdateAsync(string id, AiApiKeyUpdateDto input, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task DeleteAsync(string id, CancellationToken ct = default)
            => Task.CompletedTask;

        public Task<AiApiKeyTestResult> TestAsync(string id, AiApiKeyTestDto input, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task<string?> GetPlainKeyAsync(string id, CancellationToken ct = default)
            => Task.FromResult<string?>(null);

        public Task<string?> RotateNextPlainKeyAsync(string providerId, CancellationToken ct = default)
            => Task.FromResult<string?>(null);
    }

    private sealed class FakeChapterRecallService : IChapterRecallService
    {
        private readonly ChapterRecallResponseDto _response;

        public FakeChapterRecallService(ChapterRecallResponseDto response)
        {
            _response = response;
        }

        public Task<ChapterRecallResponseDto?> RecallAsync(
            string chapterId,
            string? query,
            int topK,
            CancellationToken ct = default)
            => Task.FromResult<ChapterRecallResponseDto?>(_response);
    }

    private sealed class TempStorage : IDisposable
    {
        public TempStorage()
        {
            Root = Path.Combine(Path.GetTempPath(), "tm-generation-tests", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(Root);
            Configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Storage:RootPath"] = Root
                })
                .Build();
        }

        public string Root { get; }

        public IConfiguration Configuration { get; }

        public void Write(string relativePath, string content)
        {
            var fullPath = Path.Combine(Root, relativePath.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
            File.WriteAllText(fullPath, content);
        }

        public void Dispose()
        {
            if (Directory.Exists(Root)) Directory.Delete(Root, recursive: true);
        }
    }
}
