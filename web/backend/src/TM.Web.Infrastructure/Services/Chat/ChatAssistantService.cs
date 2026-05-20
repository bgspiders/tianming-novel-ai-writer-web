using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos;
using TM.Web.Application.Dtos.Chat;
using TM.Web.Application.Services;
using TM.Web.Application.Services.Chat.Parsing;
using TM.Web.Domain.Common;
using TM.Web.Domain.Entities.Runtime;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Chat;

public sealed class ChatAssistantService : IChatAssistantService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly HashSet<string> AllowedModes = new(StringComparer.OrdinalIgnoreCase)
    {
        "agent",
        "plan",
        "edit"
    };

    private readonly AppDbContext _db;
    private readonly IAiCompletionService _ai;
    private readonly IAiApiKeyService _apiKeys;
    private readonly IGenerationNotifier _notifier;

    public ChatAssistantService(AppDbContext db, IAiCompletionService ai, IAiApiKeyService apiKeys, IGenerationNotifier notifier)
    {
        _db = db;
        _ai = ai;
        _apiKeys = apiKeys;
        _notifier = notifier;
    }

    public async Task<IReadOnlyList<ChatSessionDto>> ListSessionsAsync(string? projectId, CancellationToken ct = default)
    {
        var q = _db.ChatSessions.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(projectId))
        {
            q = q.Where(s => s.ProjectId == projectId);
        }

        return await q
            .OrderByDescending(s => s.LastMessageAt)
            .Take(100)
            .Select(s => ToDto(s))
            .ToListAsync(ct);
    }

    public async Task<ChatSessionDto> CreateSessionAsync(ChatSessionCreateRequest request, CancellationToken ct = default)
    {
        var mode = NormalizeMode(request.Mode);
        var session = new ChatSession
        {
            ProjectId = string.IsNullOrWhiteSpace(request.ProjectId) ? null : request.ProjectId.Trim(),
            Title = string.IsNullOrWhiteSpace(request.Title) ? DefaultTitle(mode) : request.Title.Trim(),
            Mode = mode,
            ProviderId = string.IsNullOrWhiteSpace(request.ProviderId) ? null : request.ProviderId.Trim(),
            ModelCode = string.IsNullOrWhiteSpace(request.ModelCode) ? null : request.ModelCode.Trim(),
            LastMessageAt = DateTime.UtcNow
        };

        _db.ChatSessions.Add(session);
        await _db.SaveChangesAsync(ct);
        return ToDto(session);
    }

    public async Task<ChatSessionDto> UpdateSessionAsync(string id, ChatSessionUpdateRequest request, CancellationToken ct = default)
    {
        var session = await _db.ChatSessions.FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw new KeyNotFoundException($"会话不存在：{id}");

        if (!string.IsNullOrWhiteSpace(request.Title)) session.Title = request.Title.Trim();
        if (!string.IsNullOrWhiteSpace(request.Mode)) session.Mode = NormalizeMode(request.Mode);
        if (request.ProviderId is not null) session.ProviderId = string.IsNullOrWhiteSpace(request.ProviderId) ? null : request.ProviderId.Trim();
        if (request.ModelCode is not null) session.ModelCode = string.IsNullOrWhiteSpace(request.ModelCode) ? null : request.ModelCode.Trim();

        await _db.SaveChangesAsync(ct);
        return ToDto(session);
    }

    public async Task DeleteSessionAsync(string id, CancellationToken ct = default)
    {
        var session = await _db.ChatSessions.FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw new KeyNotFoundException($"会话不存在：{id}");
        _db.ChatSessions.Remove(session);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<ChatMessageDto>> ListMessagesAsync(string sessionId, CancellationToken ct = default)
    {
        return await _db.ChatMessages.AsNoTracking()
            .Where(m => m.ChatSessionId == sessionId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => ToDto(m))
            .ToListAsync(ct);
    }

    public async Task<SendChatMessageResult> SendMessageAsync(string sessionId, SendChatMessageRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.RunId)) throw new ArgumentException("RunId 不能为空。", nameof(request));
        if (string.IsNullOrWhiteSpace(request.Content)) throw new ArgumentException("消息内容不能为空。", nameof(request));

        var session = await _db.ChatSessions
            .Include(s => s.Messages.OrderBy(m => m.CreatedAt))
            .FirstOrDefaultAsync(s => s.Id == sessionId, ct)
            ?? throw new KeyNotFoundException($"会话不存在：{sessionId}");

        var userMessage = new ChatMessage
        {
            ChatSessionId = session.Id,
            Role = "user",
            Content = request.Content.Trim()
        };
        _db.ChatMessages.Add(userMessage);
        await _db.SaveChangesAsync(ct);
        await PublishEventAsync(request.RunId, "message.saved", "用户消息已保存", new
        {
            messageId = userMessage.Id,
            role = userMessage.Role
        }, ct);

        var apiKey = await ResolveApiKeyAsync(request, ct);
        var prompt = await BuildPromptAsync(session, userMessage.Content, ct);
        await PublishEventAsync(request.RunId, "prompt.ready", "上下文提示词已准备", new
        {
            mode = session.Mode,
            historyCount = session.Messages.Count,
            hasProjectContext = !string.IsNullOrWhiteSpace(session.ProjectId)
        }, ct);

        var result = await _ai.StreamAsync(new AiTestRequest
        {
            RunId = request.RunId,
            Endpoint = request.Endpoint,
            ApiKey = apiKey,
            Model = request.Model,
            SystemPrompt = BuildSystemPrompt(session.Mode),
            Prompt = prompt,
            Temperature = request.Temperature.HasValue ? (float)request.Temperature.Value : null,
            MaxTokens = request.MaxTokens
        }, ct);

        var (content, thinking) = SplitThinking(result.Content ?? string.Empty);
        var thinkingBlocks = !string.IsNullOrWhiteSpace(thinking) ? ThinkingBlockParser.Parse(thinking) : Array.Empty<ThinkingBlockPayload>();
        var toolPayload = BuildToolPayload(session.Mode, userMessage.Content, content, thinkingBlocks);
        var summary = MakeAssistantSummary(session.Mode, content, toolPayload);
        var assistantMessage = new ChatMessage
        {
            ChatSessionId = session.Id,
            Role = "assistant",
            Content = content,
            Summary = summary,
            ThinkingContent = thinking,
            AnalysisBlocksJson = thinkingBlocks.Count > 0 ? JsonSerializer.Serialize(thinkingBlocks, JsonOptions) : null,
            ToolPayload = toolPayload,
            OutputTokens = result.CharCount
        };
        _db.ChatMessages.Add(assistantMessage);
        await PublishParsedEventAsync(request.RunId, session.Mode, toolPayload, thinkingBlocks.Count, ct);

        session.LastMessageAt = DateTime.UtcNow;
        session.ModelCode = request.Model;
        if (!string.IsNullOrWhiteSpace(request.ProviderId)) session.ProviderId = request.ProviderId.Trim();
        if (string.IsNullOrWhiteSpace(session.Title) || session.Title.StartsWith("新", StringComparison.OrdinalIgnoreCase))
        {
            session.Title = MakeTitle(userMessage.Content);
        }

        await _db.SaveChangesAsync(ct);
        await PublishEventAsync(request.RunId, "message.persisted", "助手消息已保存", new
        {
            messageId = assistantMessage.Id,
            summary = assistantMessage.Summary,
            outputTokens = assistantMessage.OutputTokens
        }, ct);

        return new SendChatMessageResult(
            request.RunId,
            session.Id,
            userMessage.Id,
            assistantMessage.Id,
            result.FinishReason ?? "stop",
            result.ChunkCount,
            result.CharCount,
            result.ElapsedMs);
    }

    public async Task<ExecuteChatPlanResult> ExecutePlanAsync(
        string sessionId,
        string messageId,
        ExecuteChatPlanRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.RunId)) throw new ArgumentException("RunId 不能为空。", nameof(request));

        var session = await _db.ChatSessions
            .Include(s => s.Messages)
            .FirstOrDefaultAsync(s => s.Id == sessionId, ct)
            ?? throw new KeyNotFoundException($"会话不存在：{sessionId}");

        var message = session.Messages.FirstOrDefault(m => m.Id == messageId)
            ?? throw new KeyNotFoundException($"消息不存在：{messageId}");

        if (!string.Equals(message.Role, "assistant", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("只能执行助手生成的计划消息。");
        }

        var payload = DeserializeToolPayload(message.ToolPayload)
            ?? throw new InvalidOperationException("当前消息没有可执行计划 payload。");

        if (!string.Equals(payload.Type, "plan", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("当前消息不是 Plan 模式计划。");
        }

        var steps = payload.Steps ?? Array.Empty<PlanStepPayload>();
        if (steps.Count == 0)
        {
            throw new InvalidOperationException("计划没有可执行步骤。");
        }

        await PublishEventAsync(request.RunId, "execution.started", "计划执行已开始", new
        {
            mode = session.Mode,
            messageId = message.Id,
            stepCount = steps.Count
        }, ct);

        var trace = new List<ToolCallRecordPayload>();
        try
        {
            trace.Add(await RunToolStepAsync(
                request.RunId,
                1,
                "project",
                "loadContext",
                "加载项目上下文",
                BuildJsonArguments(new { session.ProjectId }),
                async token => await ExecuteLoadProjectContextAsync(session.ProjectId, token),
                ct));

            var nextIndex = 2;
            foreach (var step in steps)
            {
                trace.Add(await RunToolStepAsync(
                    request.RunId,
                    nextIndex++,
                    "plan",
                    "prepareStep",
                    $"准备步骤 {step.Index}",
                    BuildJsonArguments(new
                    {
                        step.Index,
                        step.Title,
                        step.ChapterNumber,
                        step.ContinueFromChapterId,
                        step.RewriteTargetChapterId
                    }),
                    token => ExecutePreparePlanStepAsync(session.ProjectId, step, token),
                    ct));
            }
        }
        catch
        {
            // 单步失败已写入 trace 和 RunEvent，这里继续生成汇总并回写消息。
        }

        var summary = BuildExecutionTraceSummary(trace);
        var executedPayload = payload with
        {
            TargetPanel = payload.TargetPanel ?? "ExecutionPanel",
            ExecutionTrace = trace,
            ExecutionTraceSummary = summary,
            ToolCalls = trace
        };

        message.ToolPayload = JsonSerializer.Serialize(executedPayload, JsonOptions);
        message.Summary = MakeExecutionSummary(summary);
        session.LastMessageAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        await PublishEventAsync(request.RunId, "execution.completed", "计划执行已完成", new
        {
            messageId = message.Id,
            traceCount = trace.Count,
            executionTrace = trace,
            executionTraceSummary = summary
        }, ct);

        return new ExecuteChatPlanResult(
            request.RunId,
            session.Id,
            message.Id,
            summary.FailedSteps > 0 ? "failed" : "completed",
            trace.Count,
            summary,
            ToDto(message));
    }

    private async Task<string> ResolveApiKeyAsync(SendChatMessageRequest request, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(request.ApiKey)) return request.ApiKey.Trim();
        if (string.IsNullOrWhiteSpace(request.ProviderId))
        {
            throw new ArgumentException("使用已保存 Key 时 ProviderId 不能为空。", nameof(request));
        }

        return string.IsNullOrWhiteSpace(request.ApiKeyId)
            ? await _apiKeys.RotateNextPlainKeyAsync(request.ProviderId, ct)
                ?? throw new InvalidOperationException("当前 Provider 没有可用 Key。")
            : await _apiKeys.GetPlainKeyAsync(request.ApiKeyId, ct)
                ?? throw new InvalidOperationException("Key 不存在。");
    }

    private async Task<string> BuildPromptAsync(ChatSession session, string userInput, CancellationToken ct)
    {
        var history = session.Messages
            .OrderBy(m => m.CreatedAt)
            .TakeLast(16)
            .Select(m => $"{m.Role}: {m.Content}")
            .ToList();

        var sb = new StringBuilder();
        if (!string.IsNullOrWhiteSpace(session.ProjectId))
        {
            var context = await BuildProjectContextAsync(session.ProjectId, ct);
            if (!string.IsNullOrWhiteSpace(context))
            {
                sb.AppendLine(context);
                sb.AppendLine();
            }
        }
        if (history.Count > 0)
        {
            sb.AppendLine("Conversation history:");
            foreach (var line in history) sb.AppendLine(line);
            sb.AppendLine();
        }
        sb.AppendLine("Current user request:");
        sb.AppendLine(userInput);
        return sb.ToString();
    }

    private async Task<string> BuildProjectContextAsync(string projectId, CancellationToken ct)
    {
        var project = await _db.Projects.AsNoTracking()
            .Where(p => p.Id == projectId)
            .Select(p => new { p.Id, p.Name, p.Description, p.CurrentSourceBookId, p.Version })
            .FirstOrDefaultAsync(ct);
        if (project is null)
        {
            return string.Empty;
        }

        var volumes = await _db.Volumes.AsNoTracking()
            .Where(v => v.ProjectId == projectId)
            .OrderBy(v => v.VolumeNumber)
            .Take(8)
            .Select(v => new { v.VolumeNumber, v.Title, v.Theme })
            .ToListAsync(ct);

        var chapters = await _db.Chapters.AsNoTracking()
            .Where(c => c.ProjectId == projectId)
            .OrderByDescending(c => c.ChapterNumber)
            .Take(12)
            .Select(c => new { c.ChapterNumber, c.Title, c.Status, c.WordCount, c.Summary })
            .ToListAsync(ct);

        var volumeDesigns = await FilterBySourceBook(
                _db.VolumeDesigns.AsNoTracking().Where(v => v.IsEnabled),
                project.CurrentSourceBookId)
            .OrderBy(v => v.VolumeNumber)
            .Take(6)
            .Select(v => new
            {
                v.VolumeNumber,
                v.VolumeTitle,
                v.VolumeTheme,
                v.StageGoal,
                v.MainConflict,
                v.StartChapter,
                v.EndChapter
            })
            .ToListAsync(ct);

        var chapterPlans = await FilterBySourceBook(
                _db.ChapterPlans.AsNoTracking().Where(p => p.IsEnabled),
                project.CurrentSourceBookId)
            .OrderByDescending(p => p.ChapterNumber)
            .Take(12)
            .Select(p => new
            {
                p.ChapterNumber,
                p.ChapterTitle,
                p.ChapterTheme,
                p.MainGoal,
                p.KeyTurn,
                p.ReferencedCharacterNames,
                p.ReferencedFactionNames,
                p.ReferencedLocationNames
            })
            .ToListAsync(ct);

        var validation = await _db.ValidationSummaries.AsNoTracking()
            .Where(v => v.ProjectId == projectId)
            .OrderByDescending(v => v.LastValidatedAt)
            .Select(v => new { v.TargetVolumeNumber, v.OverallResult, v.LastValidatedAt })
            .FirstOrDefaultAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("# 当前项目上下文");
        sb.AppendLine(PromptLine("ProjectId", project.Id));
        sb.AppendLine(PromptLine("项目名", project.Name));
        sb.AppendLine(PromptLine("项目描述", project.Description));
        sb.AppendLine(PromptLine("当前源书", project.CurrentSourceBookId));
        sb.AppendLine(PromptLine("版本", project.Version.ToString()));

        if (volumes.Count > 0)
        {
            sb.AppendLine("## 分卷");
            foreach (var v in volumes)
            {
                sb.AppendLine($"- 第{v.VolumeNumber}卷 {FirstNonEmpty(v.Title, "未命名")} {OptionalParen(v.Theme)}".TrimEnd());
            }
        }

        if (volumeDesigns.Count > 0)
        {
            sb.AppendLine("## 分卷规划");
            foreach (var v in volumeDesigns)
            {
                sb.AppendLine($"- 第{v.VolumeNumber}卷 {FirstNonEmpty(v.VolumeTitle, "未命名")} [{v.StartChapter}-{v.EndChapter}]");
                AppendIndented(sb, "主题", v.VolumeTheme);
                AppendIndented(sb, "阶段目标", v.StageGoal);
                AppendIndented(sb, "主冲突", v.MainConflict);
            }
        }

        if (chapters.Count > 0)
        {
            sb.AppendLine("## 最近章节");
            foreach (var chapter in chapters.OrderBy(c => c.ChapterNumber))
            {
                sb.AppendLine($"- 第{chapter.ChapterNumber}章 {chapter.Title} [{chapter.Status}, {chapter.WordCount}字]");
                AppendIndented(sb, "摘要", chapter.Summary);
            }
        }

        if (chapterPlans.Count > 0)
        {
            sb.AppendLine("## 最近章节规划");
            foreach (var plan in chapterPlans.OrderBy(p => p.ChapterNumber))
            {
                sb.AppendLine($"- 第{plan.ChapterNumber}章 {FirstNonEmpty(plan.ChapterTitle, plan.ChapterTheme, "未命名")}");
                AppendIndented(sb, "目标", plan.MainGoal);
                AppendIndented(sb, "转折", plan.KeyTurn);
                AppendIndented(sb, "角色", JoinList(plan.ReferencedCharacterNames));
                AppendIndented(sb, "势力", JoinList(plan.ReferencedFactionNames));
                AppendIndented(sb, "地点", JoinList(plan.ReferencedLocationNames));
            }
        }

        if (validation is not null)
        {
            sb.AppendLine("## 最近校验");
            sb.AppendLine($"- 卷号: {(validation.TargetVolumeNumber == 0 ? "全书" : validation.TargetVolumeNumber.ToString())}; 结果: {validation.OverallResult}; 时间: {validation.LastValidatedAt:yyyy-MM-dd HH:mm:ss} UTC");
        }

        return sb.ToString().Trim();
    }

    private static string BuildSystemPrompt(string mode)
        => NormalizeMode(mode) switch
        {
            "plan" => "你是天命小说创作系统的规划助手。输出清晰的执行计划。每个步骤必须以「步骤 1：标题」或「1. 标题」开头，后续行写细节、风险与验收标准。需要思考时可用 <thinking>...</thinking> 包裹内部推理摘要。",
            "edit" => "你是天命小说创作系统的编辑助手。聚焦改写、润色、结构修订和具体文本编辑，输出可直接采用的修改稿或差异说明。需要思考时可用 <thinking>...</thinking> 包裹内部推理摘要。",
            _ => "你是天命小说创作系统的 Agent 助手。根据项目上下文回答问题、拆解任务、给出可执行建议。需要思考时可用 <thinking>...</thinking> 包裹内部推理摘要。"
        };

    private static (string Content, string? Thinking) SplitThinking(string raw)
    {
        var (start, openLength, end, closeLength) = FindThinkingBounds(raw);
        if (start >= 0 && end > start)
        {
            var thinking = raw[(start + openLength)..end].Trim();
            var content = StripAnswerTags(raw[..start] + raw[(end + closeLength)..]);
            return (content, string.IsNullOrWhiteSpace(thinking) ? null : thinking);
        }

        return (StripAnswerTags(raw), null);
    }

    private static (int Start, int OpenLength, int End, int CloseLength) FindThinkingBounds(string raw)
    {
        var pairs = new[]
        {
            ("<thinking>", "</thinking>"),
            ("<think>", "</think>"),
            ("【思考】", "【/思考】"),
            ("[thinking]", "[/thinking]")
        };

        foreach (var (open, close) in pairs)
        {
            var start = raw.IndexOf(open, StringComparison.OrdinalIgnoreCase);
            var end = raw.IndexOf(close, StringComparison.OrdinalIgnoreCase);
            if (start >= 0 && end > start)
            {
                return (start, open.Length, end, close.Length);
            }
        }

        return (-1, 0, -1, 0);
    }

    private static string StripAnswerTags(string value)
    {
        return value
            .Replace("<answer>", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Replace("</answer>", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Replace("【回答】", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Replace("【/回答】", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Trim();
    }

    private static string? BuildToolPayload(string mode, string userInput, string content, IReadOnlyList<ThinkingBlockPayload> thinkingBlocks)
    {
        var normalized = NormalizeMode(mode);
        if (normalized == "plan")
        {
            var parsed = PlanStepParser.Parse(content);
            var normalizedPlan = PlanStepNormalizer.Normalize(userInput, content, parsed);
            var directive = ChapterDirectiveParser.Parse(userInput) ?? ChapterDirectiveParser.Parse(content);
            return JsonSerializer.Serialize(new ChatToolPayload(
                Type: "plan",
                TargetPanel: "ExecutionPlan",
                HideRawContentInBubble: true,
                AnalysisExpandedByDefault: false,
                RequiresExecutionEngine: true,
                Description: "计划模式 - 生成计划后执行",
                Steps: normalizedPlan.Steps,
                StepCount: normalizedPlan.Steps.Count,
                ThinkingBlocks: thinkingBlocks.Count > 0 ? thinkingBlocks : null,
                Directive: directive,
                ChapterRange: normalizedPlan.ChapterRange,
                Normalization: normalizedPlan.Normalization), JsonOptions);
        }

        if (thinkingBlocks.Count > 0)
        {
            var directive = ChapterDirectiveParser.Parse(userInput) ?? ChapterDirectiveParser.Parse(content);
            return JsonSerializer.Serialize(new ChatToolPayload(
                Type: normalized,
                TargetPanel: normalized == "agent" ? "ExecutionPanel" : null,
                HideRawContentInBubble: false,
                AnalysisExpandedByDefault: false,
                RequiresExecutionEngine: normalized == "agent",
                Description: normalized == "agent" ? "代理模式 - 直接执行任务" : "编辑模式 - 输出可采纳修改",
                ThinkingBlocks: thinkingBlocks,
                Directive: directive), JsonOptions);
        }

        var fallbackDirective = ChapterDirectiveParser.Parse(userInput) ?? ChapterDirectiveParser.Parse(content);
        return fallbackDirective is null
            ? null
            : JsonSerializer.Serialize(new ChatToolPayload(
                Type: normalized,
                TargetPanel: normalized == "agent" ? "ExecutionPanel" : null,
                RequiresExecutionEngine: normalized == "agent",
                Description: normalized == "agent" ? "代理模式 - 直接执行任务" : null,
                Directive: fallbackDirective), JsonOptions);
    }

    private static ChatToolPayload? DeserializeToolPayload(string? toolPayload)
    {
        if (string.IsNullOrWhiteSpace(toolPayload)) return null;
        try
        {
            return JsonSerializer.Deserialize<ChatToolPayload>(toolPayload, JsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private async Task<ToolCallRecordPayload> RunToolStepAsync(
        string runId,
        int stepIndex,
        string pluginName,
        string functionName,
        string title,
        string arguments,
        Func<CancellationToken, Task<string>> action,
        CancellationToken ct)
    {
        var startedAt = DateTime.UtcNow;
        var running = new ToolCallRecordPayload(
            StepIndex: stepIndex,
            PluginName: pluginName,
            FunctionName: functionName,
            Title: title,
            Arguments: arguments,
            Status: "running",
            StartTime: startedAt);

        await PublishToolEventAsync(runId, "tool.started", running, ct);

        try
        {
            var result = await action(ct);
            var completed = running with
            {
                Result = result,
                Status = "completed",
                EndTime = DateTime.UtcNow
            };
            await PublishToolEventAsync(runId, "tool.completed", completed, ct);
            return completed;
        }
        catch (OperationCanceledException ex)
        {
            var cancelled = running with
            {
                Status = "cancelled",
                EndTime = DateTime.UtcNow,
                ErrorMessage = string.IsNullOrWhiteSpace(ex.Message) ? "执行已取消" : ex.Message
            };
            await PublishToolEventAsync(runId, "tool.cancelled", cancelled, CancellationToken.None);
            return cancelled;
        }
        catch (Exception ex)
        {
            var failed = running with
            {
                Status = "failed",
                EndTime = DateTime.UtcNow,
                ErrorMessage = ex.Message
            };
            await PublishToolEventAsync(runId, "tool.failed", failed, CancellationToken.None);
            return failed;
        }
    }

    private async Task<string> ExecuteLoadProjectContextAsync(string? projectId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(projectId))
        {
            throw new InvalidOperationException("当前会话未绑定项目，无法加载项目上下文。");
        }

        var project = await _db.Projects.AsNoTracking()
            .Where(p => p.Id == projectId)
            .Select(p => new { p.Name, p.CurrentSourceBookId })
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException($"项目不存在：{projectId}");

        var volumeCount = await _db.Volumes.AsNoTracking().CountAsync(v => v.ProjectId == projectId, ct);
        var chapterCount = await _db.Chapters.AsNoTracking().CountAsync(c => c.ProjectId == projectId, ct);
        var latestChapter = await _db.Chapters.AsNoTracking()
            .Where(c => c.ProjectId == projectId)
            .OrderByDescending(c => c.ChapterNumber)
            .Select(c => new { c.ChapterNumber, c.Title, c.Status })
            .FirstOrDefaultAsync(ct);

        var parts = new List<string>
        {
            $"项目「{project.Name}」已加载",
            $"分卷 {volumeCount} 个",
            $"章节 {chapterCount} 个"
        };
        if (!string.IsNullOrWhiteSpace(project.CurrentSourceBookId))
        {
            parts.Add($"当前源书 {project.CurrentSourceBookId}");
        }
        if (latestChapter is not null)
        {
            parts.Add($"最新章节：第{latestChapter.ChapterNumber}章 {latestChapter.Title} [{latestChapter.Status}]");
        }

        return string.Join("；", parts);
    }

    private async Task<string> ExecutePreparePlanStepAsync(string? projectId, PlanStepPayload step, CancellationToken ct)
    {
        var notes = new List<string>();
        if (string.IsNullOrWhiteSpace(step.Title))
        {
            throw new InvalidOperationException($"步骤 {step.Index} 缺少标题。");
        }

        notes.Add($"步骤 {step.Index}「{step.Title}」已解析");

        if (string.IsNullOrWhiteSpace(projectId))
        {
            notes.Add("未绑定项目，仅完成计划结构校验");
            return string.Join("；", notes);
        }

        if (step.ChapterNumber.HasValue)
        {
            var chapter = await _db.Chapters.AsNoTracking()
                .Where(c => c.ProjectId == projectId && c.ChapterNumber == step.ChapterNumber.Value)
                .OrderByDescending(c => c.UpdatedAt)
                .Select(c => new { c.Id, c.Title, c.Status, c.WordCount })
                .FirstOrDefaultAsync(ct);

            notes.Add(chapter is null
                ? $"第{step.ChapterNumber.Value}章尚未创建，后续需要先建章或生成草稿"
                : $"匹配章节 {chapter.Id}「{chapter.Title}」[{chapter.Status}, {chapter.WordCount}字]");
        }

        if (!string.IsNullOrWhiteSpace(step.ContinueFromChapterId))
        {
            var source = await _db.Chapters.AsNoTracking()
                .Where(c => c.ProjectId == projectId && c.Id == step.ContinueFromChapterId)
                .Select(c => new { c.Title, c.ChapterNumber })
                .FirstOrDefaultAsync(ct)
                ?? throw new InvalidOperationException($"续写源章节不存在：{step.ContinueFromChapterId}");
            notes.Add($"续写源：第{source.ChapterNumber}章 {source.Title}");
        }

        if (!string.IsNullOrWhiteSpace(step.RewriteTargetChapterId))
        {
            var target = await _db.Chapters.AsNoTracking()
                .Where(c => c.ProjectId == projectId && c.Id == step.RewriteTargetChapterId)
                .Select(c => new { c.Title, c.ChapterNumber })
                .FirstOrDefaultAsync(ct)
                ?? throw new InvalidOperationException($"重写目标章节不存在：{step.RewriteTargetChapterId}");
            notes.Add($"重写目标：第{target.ChapterNumber}章 {target.Title}");
        }

        return string.Join("；", notes);
    }

    private static ExecutionTraceSummaryPayload BuildExecutionTraceSummary(IReadOnlyList<ToolCallRecordPayload> records)
    {
        var failedSummaries = records
            .Where(r => string.Equals(r.Status, "failed", StringComparison.OrdinalIgnoreCase)
                || string.Equals(r.Status, "cancelled", StringComparison.OrdinalIgnoreCase))
            .OrderBy(r => r.StepIndex)
            .Select(FormatFailedStepSummary)
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToList();

        return new ExecutionTraceSummaryPayload(
            TotalSteps: records.Count,
            CompletedSteps: records.Count(r => string.Equals(r.Status, "completed", StringComparison.OrdinalIgnoreCase)),
            FailedSteps: records.Count(r => string.Equals(r.Status, "failed", StringComparison.OrdinalIgnoreCase)
                || string.Equals(r.Status, "cancelled", StringComparison.OrdinalIgnoreCase)),
            TotalDurationSeconds: records.Where(r => r.DurationSeconds.HasValue).Sum(r => r.DurationSeconds!.Value),
            FailedStepSummaries: failedSummaries.Count > 0 ? failedSummaries : null);
    }

    private static string FormatFailedStepSummary(ToolCallRecordPayload record)
    {
        var title = FirstNonEmpty(record.Title, $"{record.PluginName}.{record.FunctionName}", $"步骤 {record.StepIndex}");
        var reason = FirstNonEmpty(record.ErrorMessage, record.Status);
        return $"步骤 {record.StepIndex}「{title}」: {reason}";
    }

    private static string MakeExecutionSummary(ExecutionTraceSummaryPayload summary)
        => summary.FailedSteps > 0
            ? $"创作计划执行完成，但有失败步骤。\n{summary.SummaryText}"
            : $"创作计划执行完成。\n{summary.SummaryText}";

    private static string BuildJsonArguments<T>(T value)
        => JsonSerializer.Serialize(value, JsonOptions);

    private async Task PublishParsedEventAsync(
        string runId,
        string mode,
        string? toolPayload,
        int thinkingBlockCount,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(toolPayload))
        {
            await PublishEventAsync(runId, "assistant.parsed", "助手输出已解析", new
            {
                mode = NormalizeMode(mode),
                thinkingBlockCount
            }, ct);
            return;
        }

        ChatToolPayload? payload = null;
        try
        {
            payload = JsonSerializer.Deserialize<ChatToolPayload>(toolPayload, JsonOptions);
        }
        catch (JsonException)
        {
            // Payload 已经作为原始 JSON 落库，事件解析失败不影响主流程。
        }

        await PublishEventAsync(runId, "assistant.parsed", "助手输出已解析", new
        {
            mode = NormalizeMode(mode),
            stepCount = payload?.StepCount ?? payload?.Steps?.Count,
            thinkingBlockCount,
            traceCount = payload?.ExecutionTrace?.Count ?? payload?.ToolCalls?.Count ?? 0,
            executionTraceSummary = payload?.ExecutionTraceSummary,
            directive = payload?.Directive,
            normalization = payload?.Normalization,
            chapterRange = payload?.ChapterRange
        }, ct);
    }

    private Task PublishEventAsync(string runId, string type, string message, object? data, CancellationToken ct)
        => _notifier.EventAsync(runId, new ChatRunEventDto(type, message, DateTime.UtcNow, data), ct);

    private Task PublishToolEventAsync(string runId, string eventType, ToolCallRecordPayload record, CancellationToken ct)
        => PublishEventAsync(runId, eventType, ToolEventMessage(eventType, record), new
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
        }, ct);

    private static string ToolEventMessage(string eventType, ToolCallRecordPayload record)
    {
        var title = FirstNonEmpty(record.Title, $"{record.PluginName}.{record.FunctionName}", $"步骤 {record.StepIndex}");
        return eventType switch
        {
            "tool.started" => $"开始执行：{title}",
            "tool.completed" => $"执行完成：{title}",
            "tool.failed" => $"执行失败：{title}",
            "tool.cancelled" => $"执行取消：{title}",
            _ => $"工具事件：{title}"
        };
    }

    private static string NormalizeMode(string? mode)
    {
        var normalized = string.IsNullOrWhiteSpace(mode) ? "agent" : mode.Trim().ToLowerInvariant();
        if (!AllowedModes.Contains(normalized))
        {
            throw new InvalidOperationException("AI 助手模式必须是 agent / plan / edit 之一。");
        }
        return normalized;
    }

    private static string DefaultTitle(string mode)
        => mode switch
        {
            "plan" => "新规划会话",
            "edit" => "新编辑会话",
            _ => "新 Agent 会话"
        };

    private static string MakeTitle(string content)
    {
        var compact = string.Join(" ", content.Split(default(string[]), StringSplitOptions.RemoveEmptyEntries));
        return compact.Length <= 24 ? compact : compact[..24] + "...";
    }

    private static string MakeSummary(string content)
    {
        var compact = string.Join(" ", content.Split(default(string[]), StringSplitOptions.RemoveEmptyEntries));
        return compact.Length <= 120 ? compact : compact[..120] + "...";
    }

    private static string MakeAssistantSummary(string mode, string content, string? toolPayload)
    {
        if (NormalizeMode(mode) == "plan" && !string.IsNullOrWhiteSpace(toolPayload))
        {
            try
            {
                var payload = JsonSerializer.Deserialize<ChatToolPayload>(toolPayload, JsonOptions);
                if (payload?.StepCount > 0)
                {
                    return $"已生成创作计划，共 {payload.StepCount} 个步骤。\n请在「执行计划」面板查看详细步骤。";
                }
            }
            catch (JsonException)
            {
                return "计划解析失败，请重新描述您的需求。";
            }
        }

        return MakeSummary(content);
    }

    private static IQueryable<T> FilterBySourceBook<T>(IQueryable<T> query, string? sourceBookId)
        where T : BusinessDataBase
        => string.IsNullOrWhiteSpace(sourceBookId)
            ? query
            : query.Where(x => x.SourceBookId == sourceBookId);

    private static string PromptLine(string label, string? value)
        => string.IsNullOrWhiteSpace(value) ? string.Empty : $"- {label}: {value.Trim()}";

    private static void AppendIndented(StringBuilder sb, string label, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            sb.AppendLine($"  - {label}: {value.Trim()}");
        }
    }

    private static string JoinList(IEnumerable<string> values)
        => string.Join("、", values.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).Distinct(StringComparer.OrdinalIgnoreCase));

    private static string FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim() ?? string.Empty;

    private static string OptionalParen(string? value)
        => string.IsNullOrWhiteSpace(value) ? string.Empty : $"({value.Trim()})";

    private static ChatSessionDto ToDto(ChatSession s)
        => new(s.Id, s.ProjectId, s.Title, s.Mode, s.ModelCode, s.ProviderId, s.LastMessageAt, s.CreatedAt, s.UpdatedAt);

    private static ChatMessageDto ToDto(ChatMessage m)
        => new(m.Id, m.ChatSessionId, m.Role, m.Content, m.Summary, m.ThinkingContent, m.AnalysisBlocksJson, m.ToolPayload, m.InputTokens, m.OutputTokens, m.CreatedAt, m.UpdatedAt);
}
