using FluentAssertions;
using System.Text.Json;
using TM.Web.Application.Dtos.Chat;
using TM.Web.Application.Services.Chat.Parsing;
using Xunit;

namespace TM.Web.Tests;

public class ChatParsingTests
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [Theory]
    [InlineData("十二", 12)]
    [InlineData("二十五", 25)]
    [InlineData("壹佰零三", 103)]
    [InlineData("2千零5", 2005)]
    public void ChineseNumberParser_parses_complex_numbers(string input, int expected)
    {
        ChineseNumberParser.Parse(input).Should().Be(expected);
    }

    [Fact]
    public void PlanStepParser_parses_steps_and_chapter_directives()
    {
        var content = """
        步骤 十二：第十二章：破阵
        @续写 vol1_ch11
        衔接上一章战斗。

        13. 第十三章：余波
        @重写 vol1_ch13
        收束冲突。
        """;

        var steps = PlanStepParser.Parse(content);

        steps.Should().HaveCount(2);
        steps[0].Index.Should().Be(12);
        steps[0].ChapterNumber.Should().Be(12);
        steps[0].ContinueFromChapterId.Should().Be("vol1_ch11");
        steps[1].RewriteTargetChapterId.Should().Be("vol1_ch13");
    }

    [Fact]
    public void PlanStepNormalizer_splits_explicit_chapter_range()
    {
        var parsed = PlanStepParser.Parse("""
        1. 章节筹备
        梳理第十章到第十二章的节奏。
        """);

        var result = PlanStepNormalizer.Normalize("生成第十章到第十二章", "模型计划", parsed);

        result.Normalization.Should().Be("chapterRangeSplit");
        result.ChapterRange.Should().Be(new ChapterRangePayload(10, 12));
        result.Steps.Select(step => step.ChapterNumber).Should().Equal(10, 11, 12);
    }

    [Fact]
    public void PlanStepNormalizer_keeps_generic_multi_step_plan()
    {
        var parsed = PlanStepParser.Parse("""
        1. 梳理设定
        检查世界观。

        2. 输出建议
        给出修改点。
        """);

        var result = PlanStepNormalizer.Normalize("检查设定并给建议", "模型计划", parsed);

        result.Normalization.Should().BeNull();
        result.Steps.Should().HaveCount(2);
    }

    [Fact]
    public void ThinkingBlockParser_splits_heading_blocks()
    {
        var blocks = ThinkingBlockParser.Parse("""
        # 目标判断
        这是 plan 模式。
        风险：
        需要确认章节范围。
        """);

        blocks.Should().HaveCount(2);
        blocks[0].Title.Should().Be("目标判断");
        blocks[0].Detail.Should().Contain("plan 模式");
        blocks[1].Title.Should().Be("风险");
    }

    [Fact]
    public void ChatToolPayload_serializes_plan_display_strategy_and_execution_engine_hint()
    {
        var payload = new ChatToolPayload(
            Type: "plan",
            TargetPanel: "ExecutionPlan",
            HideRawContentInBubble: true,
            AnalysisExpandedByDefault: false,
            RequiresExecutionEngine: true,
            Description: "计划模式 - 生成计划后执行",
            Steps:
            [
                new PlanStepPayload(
                    Index: 1,
                    Title: "第十二章：破阵",
                    Detail: "衔接上一章战斗。",
                    ChapterNumber: 12,
                    ContinueFromChapterId: "vol1_ch11")
            ],
            StepCount: 1,
            ThinkingBlocks:
            [
                new ThinkingBlockPayload(1, "目标判断", "这是 plan 模式。")
            ],
            Directive: new ChapterDirectivePayload("continue", "vol1_ch11"),
            ChapterRange: new ChapterRangePayload(12, 12),
            Normalization: "singleChapter");

        var json = JsonSerializer.Serialize(payload, JsonOptions);
        var roundTripped = JsonSerializer.Deserialize<ChatToolPayload>(json, JsonOptions);
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        root.GetProperty("targetPanel").GetString().Should().Be("ExecutionPlan");
        root.GetProperty("hideRawContentInBubble").GetBoolean().Should().BeTrue();
        root.GetProperty("analysisExpandedByDefault").GetBoolean().Should().BeFalse();
        root.GetProperty("requiresExecutionEngine").GetBoolean().Should().BeTrue();
        root.GetProperty("steps")[0].GetProperty("continueFromChapterId").GetString().Should().Be("vol1_ch11");
        root.GetProperty("thinkingBlocks")[0].GetProperty("title").GetString().Should().Be("目标判断");
        root.GetProperty("chapterRange").GetProperty("start").GetInt32().Should().Be(12);

        roundTripped.Should().NotBeNull();
        roundTripped!.Type.Should().Be("plan");
        roundTripped.TargetPanel.Should().Be("ExecutionPlan");
        roundTripped.RequiresExecutionEngine.Should().BeTrue();
        roundTripped.Steps.Should().ContainSingle(step => step.ChapterNumber == 12);
        roundTripped.Normalization.Should().Be("singleChapter");
    }

    [Fact]
    public void ChatToolPayload_serializes_execution_trace_and_summary_payload()
    {
        var startedAt = new DateTime(2026, 5, 20, 8, 30, 0, DateTimeKind.Utc);
        var finishedAt = startedAt.AddMilliseconds(1340);
        var payload = new ChatToolPayload(
            Type: "plan",
            TargetPanel: "ExecutionPanel",
            RequiresExecutionEngine: true,
            ExecutionTrace:
            [
                new ToolCallRecordPayload(
                    StepIndex: 1,
                    PluginName: "project",
                    FunctionName: "loadContext",
                    Title: "加载项目上下文",
                    Arguments: "{\"projectId\":\"p1\"}",
                    Result: "已加载 3 条上下文",
                    Status: "completed",
                    StartTime: startedAt,
                    EndTime: finishedAt)
            ],
            ExecutionTraceSummary: new ExecutionTraceSummaryPayload(
                TotalSteps: 2,
                CompletedSteps: 1,
                FailedSteps: 1,
                TotalDurationSeconds: 3.4,
                FailedStepSummaries:
                [
                    "步骤 2 写入章节失败"
                ]),
            ToolCalls:
            [
                new ToolCallRecordPayload(
                    StepIndex: 2,
                    PluginName: "chapter",
                    FunctionName: "saveDraft",
                    Title: "保存章节草稿",
                    Arguments: "{\"chapterId\":\"vol1_ch12\"}",
                    Status: "failed",
                    ErrorMessage: "章节不存在")
            ]);

        var json = JsonSerializer.Serialize(payload, JsonOptions);
        var roundTripped = JsonSerializer.Deserialize<ChatToolPayload>(json, JsonOptions);
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        root.GetProperty("executionTrace")[0].GetProperty("pluginName").GetString().Should().Be("project");
        root.GetProperty("executionTrace")[0].GetProperty("durationSeconds").GetDouble().Should().BeApproximately(1.34, 0.001);
        root.GetProperty("executionTraceSummary").GetProperty("failedSteps").GetInt32().Should().Be(1);
        root.GetProperty("executionTraceSummary").GetProperty("summaryText").GetString().Should().Be("共 2 步（1 失败），耗时 3.4s");
        root.GetProperty("executionTraceSummary").GetProperty("failedStepSummaries")[0].GetString().Should().Contain("写入章节失败");
        root.GetProperty("toolCalls")[0].GetProperty("status").GetString().Should().Be("failed");
        root.GetProperty("toolCalls")[0].GetProperty("errorMessage").GetString().Should().Be("章节不存在");

        roundTripped.Should().NotBeNull();
        roundTripped!.ExecutionTrace.Should().ContainSingle(call => call.FunctionName == "loadContext");
        roundTripped.ExecutionTrace![0].DurationSeconds.Should().BeApproximately(1.34, 0.001);
        roundTripped.ExecutionTraceSummary!.CompletedSteps.Should().Be(1);
        roundTripped.ExecutionTraceSummary.SummaryText.Should().Be("共 2 步（1 失败），耗时 3.4s");
        roundTripped.ToolCalls.Should().ContainSingle(call => call.Status == "failed");
    }

    [Fact]
    public void ChatRunEventDto_serializes_tool_lifecycle_events_in_executor_order()
    {
        var startedAt = new DateTime(2026, 5, 20, 8, 30, 0, DateTimeKind.Utc);
        var completedAt = startedAt.AddMilliseconds(780);
        var failedAt = completedAt.AddMilliseconds(220);
        var cancelledAt = failedAt.AddMilliseconds(90);
        var events = new[]
        {
            ToolEvent(
                "tool.started",
                "开始执行：加载项目上下文",
                startedAt,
                new ToolCallRecordPayload(
                    StepIndex: 1,
                    PluginName: "project",
                    FunctionName: "loadContext",
                    Title: "加载项目上下文",
                    Arguments: "{\"projectId\":\"p1\"}",
                    Status: "running",
                    StartTime: startedAt)),
            ToolEvent(
                "tool.completed",
                "执行完成：加载项目上下文",
                completedAt,
                new ToolCallRecordPayload(
                    StepIndex: 1,
                    PluginName: "project",
                    FunctionName: "loadContext",
                    Title: "加载项目上下文",
                    Arguments: "{\"projectId\":\"p1\"}",
                    Result: "已加载 3 条上下文",
                    Status: "completed",
                    StartTime: startedAt,
                    EndTime: completedAt)),
            ToolEvent(
                "tool.failed",
                "执行失败：保存章节草稿",
                failedAt,
                new ToolCallRecordPayload(
                    StepIndex: 2,
                    PluginName: "chapter",
                    FunctionName: "saveDraft",
                    Title: "保存章节草稿",
                    Arguments: "{\"chapterId\":\"vol1_ch12\"}",
                    Status: "failed",
                    StartTime: completedAt,
                    EndTime: failedAt,
                    ErrorMessage: "章节不存在")),
            ToolEvent(
                "tool.cancelled",
                "执行取消：生成章节草稿",
                cancelledAt,
                new ToolCallRecordPayload(
                    StepIndex: 3,
                    PluginName: "chapter",
                    FunctionName: "generateDraft",
                    Title: "生成章节草稿",
                    Status: "cancelled",
                    StartTime: failedAt,
                    EndTime: cancelledAt,
                    ErrorMessage: "用户取消"))
        };

        var json = JsonSerializer.Serialize(events, JsonOptions);
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        root.EnumerateArray().Select(item => item.GetProperty("type").GetString())
            .Should().Equal("tool.started", "tool.completed", "tool.failed", "tool.cancelled");
        root[0].GetProperty("data").GetProperty("toolCall").GetProperty("status").GetString().Should().Be("running");
        root[1].GetProperty("data").GetProperty("toolCall").GetProperty("result").GetString().Should().Be("已加载 3 条上下文");
        root[1].GetProperty("data").GetProperty("durationSeconds").GetDouble().Should().BeApproximately(0.78, 0.001);
        root[2].GetProperty("data").GetProperty("errorMessage").GetString().Should().Be("章节不存在");
        root[3].GetProperty("data").GetProperty("toolCall").GetProperty("status").GetString().Should().Be("cancelled");
        root[3].GetProperty("message").GetString().Should().Be("执行取消：生成章节草稿");
    }

    [Fact]
    public void ChatToolPayload_preserves_failed_and_cancelled_trace_records_with_failure_summary()
    {
        var firstStartedAt = new DateTime(2026, 5, 20, 8, 30, 0, DateTimeKind.Utc);
        var secondStartedAt = firstStartedAt.AddSeconds(2);
        var payload = new ChatToolPayload(
            Type: "plan",
            TargetPanel: "ExecutionPanel",
            RequiresExecutionEngine: true,
            ExecutionTrace:
            [
                new ToolCallRecordPayload(
                    StepIndex: 1,
                    PluginName: "chapter",
                    FunctionName: "saveDraft",
                    Title: "保存章节草稿",
                    Arguments: "{\"chapterId\":\"vol1_ch12\"}",
                    Status: "failed",
                    StartTime: firstStartedAt,
                    EndTime: firstStartedAt.AddSeconds(1.25),
                    ErrorMessage: "章节不存在"),
                new ToolCallRecordPayload(
                    StepIndex: 2,
                    PluginName: "chapter",
                    FunctionName: "generateDraft",
                    Title: "生成章节草稿",
                    Status: "cancelled",
                    StartTime: secondStartedAt,
                    EndTime: secondStartedAt.AddSeconds(0.5),
                    ErrorMessage: "执行已取消")
            ],
            ExecutionTraceSummary: new ExecutionTraceSummaryPayload(
                TotalSteps: 2,
                CompletedSteps: 0,
                FailedSteps: 1,
                TotalDurationSeconds: 1.8,
                FailedStepSummaries:
                [
                    "步骤 1 保存章节草稿失败：章节不存在"
                ]));

        var json = JsonSerializer.Serialize(payload, JsonOptions);
        var roundTripped = JsonSerializer.Deserialize<ChatToolPayload>(json, JsonOptions);
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        root.GetProperty("executionTrace").EnumerateArray().Select(item => item.GetProperty("status").GetString())
            .Should().Equal("failed", "cancelled");
        root.GetProperty("executionTrace")[0].GetProperty("errorMessage").GetString().Should().Be("章节不存在");
        root.GetProperty("executionTrace")[1].GetProperty("errorMessage").GetString().Should().Be("执行已取消");
        root.GetProperty("executionTraceSummary").GetProperty("summaryText").GetString().Should().Be("共 2 步（1 失败），耗时 1.8s");
        root.GetProperty("executionTraceSummary").GetProperty("failedStepSummaries")[0].GetString()
            .Should().Be("步骤 1 保存章节草稿失败：章节不存在");

        roundTripped.Should().NotBeNull();
        roundTripped!.ExecutionTrace.Should().HaveCount(2);
        roundTripped.ExecutionTrace![0].DurationSeconds.Should().BeApproximately(1.25, 0.001);
        roundTripped.ExecutionTrace[1].Status.Should().Be("cancelled");
        roundTripped.ExecutionTraceSummary!.FailedStepSummaries.Should()
            .ContainSingle("步骤 1 保存章节草稿失败：章节不存在");
    }

    [Theory]
    [InlineData(2, 2, 0, 0, "共 2 步")]
    [InlineData(2, 1, 1, 0, "共 2 步（1 失败）")]
    [InlineData(3, 2, 1, 2.34, "共 3 步（1 失败），耗时 2.3s")]
    public void ExecutionTraceSummaryPayload_builds_stable_summary_text(
        int totalSteps,
        int completedSteps,
        int failedSteps,
        double totalDurationSeconds,
        string expected)
    {
        var summary = new ExecutionTraceSummaryPayload(
            TotalSteps: totalSteps,
            CompletedSteps: completedSteps,
            FailedSteps: failedSteps,
            TotalDurationSeconds: totalDurationSeconds);

        summary.SummaryText.Should().Be(expected);
    }

    [Fact]
    public void ChatRunEventDto_serializes_execution_trace_event_payload_without_network()
    {
        var evt = new ChatRunEventDto(
            Type: "assistant.parsed",
            Message: "助手输出已解析",
            At: new DateTime(2026, 5, 20, 8, 30, 0, DateTimeKind.Utc),
            Data: new
            {
                mode = "plan",
                stepCount = 2,
                thinkingBlockCount = 1,
                normalization = "chapterRangeSplit",
                chapterRange = new ChapterRangePayload(10, 11),
                toolCall = new ToolCallRecordPayload(
                    StepIndex: 1,
                    PluginName: "chapter",
                    FunctionName: "generateDraft",
                    Title: "生成章节草稿",
                    Status: "running"),
                executionTraceSummary = new ExecutionTraceSummaryPayload(
                    TotalSteps: 2,
                    CompletedSteps: 0,
                    FailedSteps: 0,
                    TotalDurationSeconds: 0)
            });

        var json = JsonSerializer.Serialize(evt, JsonOptions);
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        root.GetProperty("type").GetString().Should().Be("assistant.parsed");
        root.GetProperty("message").GetString().Should().Be("助手输出已解析");
        root.GetProperty("at").GetString().Should().Be("2026-05-20T08:30:00Z");
        root.GetProperty("data").GetProperty("mode").GetString().Should().Be("plan");
        root.GetProperty("data").GetProperty("stepCount").GetInt32().Should().Be(2);
        root.GetProperty("data").GetProperty("chapterRange").GetProperty("end").GetInt32().Should().Be(11);
        root.GetProperty("data").GetProperty("toolCall").GetProperty("functionName").GetString().Should().Be("generateDraft");
        root.GetProperty("data").GetProperty("executionTraceSummary").GetProperty("totalSteps").GetInt32().Should().Be(2);
    }

    private static ChatRunEventDto ToolEvent(
        string type,
        string message,
        DateTime at,
        ToolCallRecordPayload record)
        => new(
            Type: type,
            Message: message,
            At: at,
            Data: new
            {
                toolCall = record,
                record.StepIndex,
                record.PluginName,
                record.FunctionName,
                record.Title,
                record.Arguments,
                record.Result,
                record.Status,
                record.StartTime,
                record.EndTime,
                record.DurationSeconds,
                record.ErrorMessage
            });
}
