using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos;
using TM.Web.Application.Dtos.Ai;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;
using TM.Web.Infrastructure.Services.Generation;
using Xunit;

namespace TM.Web.Tests;

public class NovelSeedTrackingTests
{
    [Fact]
    public async Task GenerateAsync_seeds_tracking_facts_for_validation_overview()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var service = new NovelSeedService(
            db,
            new StubAiCompletionService(BuildPlanJson()),
            new StubAiApiKeyService());

        var result = await service.GenerateAsync(new NovelSeedRequest
        {
            Description = "赛博玄幻，沈栀潜入第三潮汐塔。",
            Genre = "赛博玄幻",
            VolumeCount = 1,
            ChaptersPerVolume = 3,
            InitialChapterPlanCount = 3,
            CreateChapters = true,
            CreateDesignData = true,
            ApiKey = "sk-test",
            Endpoint = "https://example.com/v1",
            Model = "test-model"
        });

        var projectId = result.Project.Id;
        var sourceBookId = result.Project.CurrentSourceBookId;

        (await db.CharacterStateEntries.CountAsync(x => x.ProjectId == projectId && x.SourceBookId == sourceBookId))
            .Should().Be(2);
        (await db.CharacterStatePoints.CountAsync())
            .Should().Be(2);
        (await db.FactionStateEntries.CountAsync(x => x.ProjectId == projectId && x.SourceBookId == sourceBookId))
            .Should().Be(1);
        (await db.LocationStateEntries.CountAsync(x => x.ProjectId == projectId && x.SourceBookId == sourceBookId))
            .Should().Be(1);
        (await db.ConflictProgressEntries.CountAsync(x => x.ProjectId == projectId && x.SourceBookId == sourceBookId))
            .Should().BeGreaterThanOrEqualTo(1);
        (await db.ChapterTimelines.CountAsync(x => x.ProjectId == projectId && x.SourceBookId == sourceBookId))
            .Should().Be(3);
        (await db.PlotPoints.CountAsync(x => x.ProjectId == projectId && x.SourceBookId == sourceBookId))
            .Should().Be(3);
        (await db.Foreshadowings.CountAsync(x => x.ProjectId == projectId && x.SourceBookId == sourceBookId))
            .Should().BeGreaterThanOrEqualTo(1);
        (await db.CharacterLocations.CountAsync(x => x.ProjectId == projectId && x.SourceBookId == sourceBookId))
            .Should().Be(2);
    }

    private static string BuildPlanJson()
        => """
        {
          "projectTitle": "潮汐塔潜入线",
          "logline": "沈栀潜入第三潮汐塔，揭开潮汐财团实验。",
          "genre": "赛博玄幻",
          "theme": "真相与代价",
          "tone": "悬疑压迫",
          "world": {
            "name": "潮汐城",
            "oneLineSummary": "潮汐能量改造城市秩序。",
            "powerSystem": "潮汐术式",
            "cosmology": "潮汐周期影响灵能。",
            "specialLaws": "第三潮汐不得被直视。",
            "hardRules": "潮汐塔内所有记忆都会被记录。",
            "statusQuo": "潮汐财团控制城市资源。"
          },
          "characters": [
            {
              "name": "沈栀",
              "type": "主角",
              "identity": "潜入者",
              "appearance": "黑色战术外套",
              "want": "潜入第三潮汐塔",
              "need": "确认实验真相",
              "growthPath": "从单兵潜入转向联盟反击",
              "abilities": "潮汐感知",
              "signatureItems": "潮汐密钥"
            },
            {
              "name": "陆衡",
              "type": "盟友",
              "identity": "内线工程师",
              "want": "保住证据",
              "need": "摆脱财团控制",
              "growthPath": "从自保到协助沈栀",
              "abilities": "塔内权限",
              "signatureItems": "维修终端"
            }
          ],
          "factions": [
            {
              "name": "潮汐财团",
              "type": "企业势力",
              "goal": "隐藏永生实验",
              "territory": "第三潮汐塔",
              "leader": "董事会",
              "coreMembers": "安保部、实验部",
              "enemies": "沈栀"
            }
          ],
          "locations": [
            {
              "name": "第三潮汐塔",
              "type": "核心地点",
              "description": "财团封锁的实验塔。",
              "scale": "巨型塔楼",
              "terrain": "垂直城区",
              "climate": "潮湿低温",
              "landmarks": ["潮汐中枢"],
              "resources": ["实验数据"],
              "dangers": ["记忆监控"]
            }
          ],
          "volumes": [
            {
              "number": 1,
              "title": "第三潮汐",
              "theme": "潜入与真相",
              "stageGoal": "进入第三潮汐塔并取得实验线索。",
              "mainConflict": "沈栀与潮汐财团的潜入封锁冲突。",
              "openingState": "沈栀在塔外准备潜入。",
              "endingState": "财团发现内线存在。",
              "keyEvents": "潜入、接头、取得密钥。"
            }
          ],
          "chapters": [
            {
              "number": 1,
              "volumeNumber": 1,
              "title": "塔外潮声",
              "summary": "沈栀抵达塔外，确认潜入口。",
              "mainGoal": "找到进入第三潮汐塔的路径。",
              "coreEvent": "沈栀接近第三潮汐塔。",
              "conflict": "潮汐财团封锁外围。",
              "keyTurn": "陆衡发来内线坐标。",
              "hook": "潮汐监控捕捉到异常。",
              "temporalAnchor": "第一夜",
              "spatialAnchor": "第三潮汐塔外环",
              "timelineCoordinate": "卷1/章1/潜入前",
              "foreshadowingTier": "Tier-2",
              "foreshadowingRole": "埋设",
              "characters": ["沈栀", "陆衡"],
              "factions": ["潮汐财团"],
              "locations": ["第三潮汐塔"]
            },
            {
              "number": 2,
              "volumeNumber": 1,
              "title": "内线终端",
              "summary": "陆衡交出维修终端，沈栀进入塔内。",
              "mainGoal": "突破第一道门禁。",
              "coreEvent": "沈栀使用维修终端潜入。",
              "conflict": "塔内权限不断收缩。",
              "keyTurn": "维修终端暴露隐藏楼层。",
              "hook": "董事会警报被静默触发。",
              "temporalAnchor": "第一夜后半",
              "spatialAnchor": "第三潮汐塔维修层",
              "timelineCoordinate": "卷1/章2/潜入中",
              "characters": ["沈栀", "陆衡"],
              "factions": ["潮汐财团"],
              "locations": ["第三潮汐塔"]
            },
            {
              "number": 3,
              "volumeNumber": 1,
              "title": "潮汐密钥",
              "summary": "沈栀取得密钥，但财团开始反追踪。",
              "mainGoal": "拿到实验数据入口。",
              "coreEvent": "潮汐密钥被激活。",
              "conflict": "财团反追踪锁定沈栀。",
              "keyTurn": "密钥记录了沈栀的记忆片段。",
              "hook": "陆衡身份即将暴露。",
              "temporalAnchor": "第二日凌晨",
              "spatialAnchor": "第三潮汐塔中枢",
              "timelineCoordinate": "卷1/章3/密钥激活",
              "isSingularityEvent": true,
              "characters": ["沈栀", "陆衡"],
              "factions": ["潮汐财团"],
              "locations": ["第三潮汐塔"]
            }
          ]
        }
        """;

    private sealed class StubAiCompletionService(string content) : IAiCompletionService
    {
        public Task<AiTestResult> StreamAsync(AiTestRequest request, CancellationToken ct = default)
            => Task.FromResult(new AiTestResult { Content = content });

        public Task<AiTestResult> CompleteAsync(AiTestRequest request, CancellationToken ct = default)
            => Task.FromResult(new AiTestResult { Content = content });
    }

    private sealed class StubAiApiKeyService : IAiApiKeyService
    {
        public Task<IReadOnlyList<AiApiKeyDto>> ListAsync(string? providerId, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<AiApiKeyDto>>(Array.Empty<AiApiKeyDto>());

        public Task<AiApiKeyDto?> GetAsync(string id, CancellationToken ct = default) => Task.FromResult<AiApiKeyDto?>(null);
        public Task<AiApiKeyDto> CreateAsync(AiApiKeyCreateDto input, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<AiApiKeyDto> UpdateAsync(string id, AiApiKeyUpdateDto input, CancellationToken ct = default) => throw new NotSupportedException();
        public Task DeleteAsync(string id, CancellationToken ct = default) => Task.CompletedTask;
        public Task<AiApiKeyTestResult> TestAsync(string id, AiApiKeyTestDto input, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<string?> GetPlainKeyAsync(string id, CancellationToken ct = default) => Task.FromResult<string?>("sk-test");
        public Task<string?> RotateNextPlainKeyAsync(string providerId, CancellationToken ct = default) => Task.FromResult<string?>("sk-test");
    }
}
