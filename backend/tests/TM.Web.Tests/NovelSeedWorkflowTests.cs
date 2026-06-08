using FluentAssertions;
using TM.Web.Application.Dtos;
using TM.Web.Application.Dtos.Ai;
using TM.Web.Application.Dtos.Chat;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;
using TM.Web.Infrastructure.Services.Generation;
using Xunit;

namespace TM.Web.Tests;

public class NovelSeedWorkflowTests
{
    [Fact]
    public async Task CreateAsync_persists_default_steps_for_seed_workflow()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var service = new NovelSeedWorkflowService(
            db,
            new StubAiCompletionService("ok"),
            new StubAiApiKeyService(),
            new StubNovelSeedService(),
            new RecordingGenerationNotifier());

        var created = await service.CreateAsync(new NovelSeedWorkflowCreateRequest
        {
            Request = new NovelSeedRequest
            {
                Description = "赛博玄幻，沈栀潜入第三潮汐塔。",
                ApiKey = "sk-test",
                Endpoint = "https://example.com/v1",
                Model = "test-model"
            }
        });

        created.Id.Should().NotBeEmpty();
        created.Status.Should().Be("draft");
        created.Steps.Select(x => x.StepKey).Should().Equal("story", "metadata", "volumes", "chapters", "tracking", "finalize");
        db.NovelSeedWorkflows.Should().ContainSingle(x => x.Id == created.Id);
        db.NovelSeedWorkflowSteps.Should().HaveCount(6);
    }

    [Fact]
    public async Task RunStepAsync_saves_ai_output_for_non_finalize_step()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var ai = new StubAiCompletionService("## 整书压缩故事\n沈栀进入第三潮汐塔。");
        var service = new NovelSeedWorkflowService(
            db,
            ai,
            new StubAiApiKeyService(),
            new StubNovelSeedService(),
            new RecordingGenerationNotifier());

        var created = await service.CreateAsync(new NovelSeedWorkflowCreateRequest
        {
            Request = new NovelSeedRequest
            {
                Description = "赛博玄幻，沈栀潜入第三潮汐塔。",
                ApiKey = "sk-test",
                Endpoint = "https://example.com/v1",
                Model = "test-model"
            }
        });

        var result = await service.RunStepAsync(created.Id, "story", CancellationToken.None);

        result.Status.Should().Be("completed");
        result.Output.Should().Contain("沈栀");
        ai.CapturedPrompt.Should().Contain("整书压缩故事");
        db.NovelSeedWorkflowSteps.Single(x => x.WorkflowId == created.Id && x.StepKey == "story")
            .Output.Should().Contain("第三潮汐塔");
        db.PromptRunSnapshots.Should().ContainSingle(x =>
            x.WorkflowId == created.Id
            && x.StepKey == "story"
            && x.Source == "novel_seed_workflow"
            && x.ContextHash.Length == 64
            && x.OutputSummary.Contains("沈栀"));
    }

    [Fact]
    public async Task ListAsync_returns_recent_workflows_and_DeleteAsync_removes_steps()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var service = new NovelSeedWorkflowService(
            db,
            new StubAiCompletionService("ok"),
            new StubAiApiKeyService(),
            new StubNovelSeedService(),
            new RecordingGenerationNotifier());

        var first = await service.CreateAsync(new NovelSeedWorkflowCreateRequest
        {
            Request = new NovelSeedRequest
            {
                Description = "第一本书",
                ApiKey = "sk-test",
                Endpoint = "https://example.com/v1",
                Model = "test-model"
            }
        });
        var second = await service.CreateAsync(new NovelSeedWorkflowCreateRequest
        {
            Request = new NovelSeedRequest
            {
                Description = "第二本书",
                ApiKey = "sk-test",
                Endpoint = "https://example.com/v1",
                Model = "test-model"
            }
        });

        var listed = await service.ListAsync(take: 10);

        listed.Select(x => x.Id).Should().Contain(new[] { first.Id, second.Id });
        listed.First().Id.Should().Be(second.Id);

        await service.DeleteAsync(first.Id);

        (await service.GetAsync(first.Id)).Should().BeNull();
        db.NovelSeedWorkflowSteps.Should().NotContain(x => x.WorkflowId == first.Id);
    }

    [Fact]
    public async Task ConfirmStepAsync_only_allows_completed_steps()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var service = new NovelSeedWorkflowService(
            db,
            new StubAiCompletionService("## 整书压缩故事\n沈栀进入第三潮汐塔。"),
            new StubAiApiKeyService(),
            new StubNovelSeedService(),
            new RecordingGenerationNotifier());

        var created = await service.CreateAsync(new NovelSeedWorkflowCreateRequest
        {
            Request = new NovelSeedRequest
            {
                Description = "赛博玄幻，沈栀潜入第三潮汐塔。",
                ApiKey = "sk-test",
                Endpoint = "https://example.com/v1",
                Model = "test-model"
            }
        });

        var pendingConfirm = async () => await service.ConfirmStepAsync(created.Id, "metadata", true);
        await pendingConfirm.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*已完成步骤*");

        await service.RunStepAsync(created.Id, "story");
        var confirmed = await service.ConfirmStepAsync(created.Id, "story", true);

        confirmed.IsConfirmed.Should().BeTrue();
        db.NovelSeedWorkflowSteps.Single(x => x.WorkflowId == created.Id && x.StepKey == "story")
            .IsConfirmed.Should().BeTrue();
    }

    [Fact]
    public async Task Finalize_uses_completed_step_json_without_replanning()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var directSeed = new NovelSeedService(
            db,
            new StubAiCompletionService("SHOULD_NOT_BE_USED"),
            new StubAiApiKeyService());
        var notifier = new RecordingGenerationNotifier();
        var service = new NovelSeedWorkflowService(
            db,
            new StubAiCompletionService("ok"),
            new StubAiApiKeyService(),
            new ThrowingNovelSeedService(),
            notifier,
            directSeed);

        var created = await service.CreateAsync(new NovelSeedWorkflowCreateRequest
        {
            Request = new NovelSeedRequest
            {
                Description = "赛博玄幻，沈栀潜入第三潮汐塔。",
                ApiKey = "sk-test",
                Endpoint = "https://example.com/v1",
                Model = "test-model",
                VolumeCount = 1,
                ChaptersPerVolume = 3,
                InitialChapterPlanCount = 3,
                CreateDesignData = true,
                CreateChapters = true
            }
        });

        var story = db.NovelSeedWorkflowSteps.Single(x => x.WorkflowId == created.Id && x.StepKey == "story");
        story.Status = "completed";
        story.Output = "整书压缩故事已确认。";
        var chapters = db.NovelSeedWorkflowSteps.Single(x => x.WorkflowId == created.Id && x.StepKey == "chapters");
        chapters.Status = "completed";
        chapters.Output = """
        {
          "projectTitle": "潮汐塔潜入线",
          "logline": "沈栀潜入第三潮汐塔寻找父亲失踪真相。",
          "genre": "赛博玄幻",
          "theme": "潜入与觉醒",
          "tone": "紧张",
          "world": {
            "name": "潮汐都市",
            "oneLineSummary": "潮汐塔控制城市记忆。",
            "powerSystem": "潮汐感知",
            "hardRules": "塔内记忆审计不可绕过"
          },
          "characters": [
            { "name": "沈栀", "type": "主角", "identity": "潜入者", "want": "找到父亲" }
          ],
          "factions": [
            { "name": "潮汐财团", "type": "企业", "goal": "垄断记忆" }
          ],
          "locations": [
            { "name": "第三潮汐塔", "type": "高塔", "description": "财团核心塔" }
          ],
          "volumes": [
            { "number": 1, "title": "潜入卷", "theme": "入局", "stageGoal": "进入高塔", "mainConflict": "财团追捕", "endingState": "取得档案" }
          ],
          "chapters": [
            { "number": 1, "volumeNumber": 1, "title": "暗门坐标", "summary": "沈栀找到暗门坐标。", "mainGoal": "潜入准备", "coreEvent": "沈栀取得坐标", "characters": ["沈栀"], "factions": ["潮汐财团"], "locations": ["第三潮汐塔"] }
          ]
        }
        """;
        var finalize = db.NovelSeedWorkflowSteps.Single(x => x.WorkflowId == created.Id && x.StepKey == "finalize");
        finalize.Status = "ready";
        await db.SaveChangesAsync();

        var result = await service.RunStepAsync(created.Id, "finalize");

        result.Status.Should().Be("completed");
        db.Projects.Should().ContainSingle(x => x.Name == "潮汐塔潜入线");
        db.ChapterPlans.Should().Contain(x => x.ChapterTitle == "暗门坐标");
        db.NovelSeedWorkflows.Single(x => x.Id == created.Id).ProjectId.Should().NotBeNullOrWhiteSpace();
        notifier.Events.Select(x => x.Type).Should().Contain(new[]
        {
            "workflow.finalize.started",
            "workflow.finalize.outputs_loaded",
            "workflow.finalize.plan_parsed",
            "workflow.finalize.database_saved",
            "workflow.finalize.completed"
        });
        notifier.Statuses.Should().Contain("finalizing");
        notifier.CompletedReasons.Should().Contain("finalized");
    }

    [Fact]
    public async Task Finalize_merges_tracking_step_into_completed_plan_json()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var directSeed = new NovelSeedService(
            db,
            new StubAiCompletionService("SHOULD_NOT_BE_USED"),
            new StubAiApiKeyService());
        var service = new NovelSeedWorkflowService(
            db,
            new StubAiCompletionService("ok"),
            new StubAiApiKeyService(),
            new ThrowingNovelSeedService(),
            new RecordingGenerationNotifier(),
            directSeed);

        var created = await service.CreateAsync(new NovelSeedWorkflowCreateRequest
        {
            Request = new NovelSeedRequest
            {
                Description = "赛博玄幻，沈栀潜入第三潮汐塔。",
                ApiKey = "sk-test",
                Endpoint = "https://example.com/v1",
                Model = "test-model",
                VolumeCount = 1,
                ChaptersPerVolume = 3,
                InitialChapterPlanCount = 3,
                CreateDesignData = true,
                CreateChapters = true
            }
        });

        var chapters = db.NovelSeedWorkflowSteps.Single(x => x.WorkflowId == created.Id && x.StepKey == "chapters");
        chapters.Status = "completed";
        chapters.Output = """
        {
          "projectTitle": "潮汐塔潜入线",
          "logline": "沈栀潜入第三潮汐塔寻找父亲失踪真相。",
          "genre": "赛博玄幻",
          "theme": "潜入与觉醒",
          "tone": "紧张",
          "world": { "name": "潮汐都市", "oneLineSummary": "潮汐塔控制城市记忆。", "powerSystem": "潮汐感知" },
          "characters": [{ "name": "沈栀", "type": "主角", "identity": "潜入者", "want": "找到父亲" }],
          "factions": [{ "name": "潮汐财团", "type": "企业", "goal": "垄断记忆" }],
          "locations": [{ "name": "第三潮汐塔", "type": "高塔", "description": "财团核心塔" }],
          "volumes": [{ "number": 1, "title": "潜入卷", "theme": "入局", "stageGoal": "进入高塔", "mainConflict": "财团追捕", "endingState": "取得档案" }],
          "chapters": [
            { "number": 1, "volumeNumber": 1, "title": "暗门坐标", "summary": "沈栀找到暗门坐标。", "mainGoal": "潜入准备", "coreEvent": "沈栀取得坐标", "characters": ["沈栀"], "factions": ["潮汐财团"], "locations": ["第三潮汐塔"] }
          ]
        }
        """;
        var tracking = db.NovelSeedWorkflowSteps.Single(x => x.WorkflowId == created.Id && x.StepKey == "tracking");
        tracking.Status = "completed";
        tracking.Output = """
        {
          "foreshadowings": [
            { "name": "父亲声音的来源", "tier": "Tier-1", "setupChapter": 1, "payoffChapter": 3, "role": "贯穿潜入线", "description": "用声音误导沈栀进入深层。" }
          ],
          "timelines": [
            { "chapterNumber": 1, "timePeriod": "第一夜", "elapsedTime": "开篇", "keyTimeEvent": "沈栀取得暗门坐标。", "importance": "high" }
          ]
        }
        """;
        var finalize = db.NovelSeedWorkflowSteps.Single(x => x.WorkflowId == created.Id && x.StepKey == "finalize");
        finalize.Status = "ready";
        await db.SaveChangesAsync();

        var result = await service.RunStepAsync(created.Id, "finalize");

        result.Output.Should().Contain("伏笔：1");
        result.Output.Should().Contain("时间线：1");
        db.Foreshadowings.Should().ContainSingle(x => x.Name == "父亲声音的来源");
        db.ChapterTimelines.Should().ContainSingle(x => x.TimePeriod == "第一夜");
    }

    [Fact]
    public async Task StepPreview_and_RewriteStepFragment_parse_and_update_single_item()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var ai = new StubAiCompletionService("""{"number":2,"title":"新标题","summary":"新简介","coreEvent":"新事件"}""");
        var service = new NovelSeedWorkflowService(
            db,
            ai,
            new StubAiApiKeyService(),
            new StubNovelSeedService(),
            new RecordingGenerationNotifier());

        var created = await service.CreateAsync(new NovelSeedWorkflowCreateRequest
        {
            Request = new NovelSeedRequest
            {
                Description = "赛博玄幻，沈栀潜入第三潮汐塔。",
                ApiKey = "sk-test",
                Endpoint = "https://example.com/v1",
                Model = "test-model"
            }
        });

        var step = db.NovelSeedWorkflowSteps.Single(x => x.WorkflowId == created.Id && x.StepKey == "chapters");
        step.Status = "completed";
        step.IsConfirmed = true;
        step.Output = """
        {
          "chapters": [
            { "number": 1, "title": "旧标题一", "summary": "旧简介一", "coreEvent": "旧事件一" },
            { "number": 2, "title": "旧标题二", "summary": "旧简介二", "coreEvent": "旧事件二" }
          ]
        }
        """;
        await db.SaveChangesAsync();

        var preview = await service.GetStepPreviewAsync(created.Id, "chapters");

        preview.Items.Should().HaveCount(2);
        preview.Items[1].Key.Should().Be("chapters[1]");
        preview.Items[1].Title.Should().Be("第2章 旧标题二");

        var rewritten = await service.RewriteStepFragmentAsync(created.Id, "chapters", new NovelSeedWorkflowStepRewriteRequest
        {
            ItemKey = "chapters[1]",
            Instruction = "改成潜入线更明确"
        });

        rewritten.Output.Should().Contain("新标题");
        rewritten.Output.Should().Contain("旧标题一");
        rewritten.IsConfirmed.Should().BeFalse();
        ai.CapturedPrompt.Should().Contain("改成潜入线更明确");
        ai.CapturedPrompt.Should().Contain("旧标题二");
    }

    private sealed class StubAiCompletionService(string content) : IAiCompletionService
    {
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
                Content = content,
                CharCount = content.Length,
                ChunkCount = 1,
                FinishReason = "stop",
                ElapsedMs = 1
            });
        }
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

    private sealed class StubNovelSeedService : INovelSeedService
    {
        public Task<NovelSeedResult> GenerateAsync(NovelSeedRequest request, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task<IReadOnlyList<NovelSeedPlanSummaryDto>> ListPlansAsync(CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<NovelSeedPlanSummaryDto>>(Array.Empty<NovelSeedPlanSummaryDto>());

        public Task<NovelSeedConversationDto> GetOrCreateConversationAsync(
            string projectId,
            string? providerId = null,
            string? modelCode = null,
            CancellationToken ct = default)
            => throw new NotSupportedException();
    }

    private sealed class ThrowingNovelSeedService : INovelSeedService
    {
        public Task<NovelSeedResult> GenerateAsync(NovelSeedRequest request, CancellationToken ct = default)
            => throw new InvalidOperationException("不应重新调用完整开书。");

        public Task<IReadOnlyList<NovelSeedPlanSummaryDto>> ListPlansAsync(CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<NovelSeedPlanSummaryDto>>(Array.Empty<NovelSeedPlanSummaryDto>());

        public Task<NovelSeedConversationDto> GetOrCreateConversationAsync(
            string projectId,
            string? providerId = null,
            string? modelCode = null,
            CancellationToken ct = default)
            => throw new NotSupportedException();
    }

    private sealed class RecordingGenerationNotifier : IGenerationNotifier
    {
        public List<ChatRunEventDto> Events { get; } = new();
        public List<string> Statuses { get; } = new();
        public List<string> CompletedReasons { get; } = new();

        public Task TokenAsync(string runId, string token, CancellationToken ct = default) => Task.CompletedTask;

        public Task StatusAsync(string runId, string status, CancellationToken ct = default)
        {
            Statuses.Add(status);
            return Task.CompletedTask;
        }

        public Task CompletedAsync(string runId, string? finishReason, CancellationToken ct = default)
        {
            CompletedReasons.Add(finishReason ?? string.Empty);
            return Task.CompletedTask;
        }

        public Task ErrorAsync(string runId, string message, CancellationToken ct = default) => Task.CompletedTask;

        public Task EventAsync(string runId, ChatRunEventDto evt, CancellationToken ct = default)
        {
            Events.Add(evt);
            return Task.CompletedTask;
        }
    }
}
