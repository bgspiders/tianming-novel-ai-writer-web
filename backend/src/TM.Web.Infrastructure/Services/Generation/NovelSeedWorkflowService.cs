using System.Text.Json;
using System.Text.Json.Nodes;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos;
using TM.Web.Application.Dtos.Chat;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Runtime;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Generation;

public sealed class NovelSeedWorkflowService : INovelSeedWorkflowService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    private static readonly StepDefinition[] Steps =
    {
        new("story", "整书压缩故事", 10),
        new("metadata", "核心种子与小说元信息", 20),
        new("volumes", "分卷蓝图", 30),
        new("chapters", "前期章节卡", 40),
        new("tracking", "伏笔账本与时间线", 50),
        new("finalize", "落库生成项目", 60)
    };

    private readonly AppDbContext _db;
    private readonly IAiCompletionService _ai;
    private readonly IAiApiKeyService _apiKeys;
    private readonly INovelSeedService _novelSeed;
    private readonly IGenerationNotifier _notifier;
    private readonly NovelSeedService? _novelSeedDirect;

    public NovelSeedWorkflowService(
        AppDbContext db,
        IAiCompletionService ai,
        IAiApiKeyService apiKeys,
        INovelSeedService novelSeed,
        IGenerationNotifier notifier,
        NovelSeedService? novelSeedDirect = null)
    {
        _db = db;
        _ai = ai;
        _apiKeys = apiKeys;
        _novelSeed = novelSeed;
        _notifier = notifier;
        _novelSeedDirect = novelSeedDirect ?? novelSeed as NovelSeedService;
    }

    public async Task<NovelSeedWorkflowDto> CreateAsync(NovelSeedWorkflowCreateRequest request, CancellationToken ct = default)
    {
        ValidateRequest(request.Request);
        var workflow = new NovelSeedWorkflow
        {
            Status = "draft",
            RequestJson = JsonSerializer.Serialize(request.Request, JsonOptions)
        };
        _db.NovelSeedWorkflows.Add(workflow);
        foreach (var step in Steps)
        {
            _db.NovelSeedWorkflowSteps.Add(new NovelSeedWorkflowStep
            {
                WorkflowId = workflow.Id,
                StepKey = step.Key,
                Title = step.Title,
                SortOrder = step.SortOrder,
                Status = step.Key == "story" ? "ready" : "pending"
            });
        }

        await _db.SaveChangesAsync(ct);
        return (await GetAsync(workflow.Id, ct))!;
    }

    public async Task<NovelSeedWorkflowDto> UpdateRequestAsync(
        string workflowId,
        NovelSeedWorkflowUpdateRequest request,
        CancellationToken ct = default)
    {
        ValidateRequest(request.Request);
        var workflow = await _db.NovelSeedWorkflows.FirstOrDefaultAsync(x => x.Id == workflowId, ct)
            ?? throw new InvalidOperationException("AI 开书工作流不存在。");
        if (string.Equals(workflow.Status, "running", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("工作流运行中，暂时不能修改 Agent 参数。");
        }

        workflow.RequestJson = JsonSerializer.Serialize(request.Request, JsonOptions);
        workflow.ProjectId = null;
        workflow.Status = "draft";
        workflow.Error = string.Empty;
        workflow.UpdatedAt = DateTime.UtcNow;

        var steps = await _db.NovelSeedWorkflowSteps
            .Where(x => x.WorkflowId == workflowId)
            .OrderBy(x => x.SortOrder)
            .ToListAsync(ct);
        await EnsureWorkflowStepsAsync(workflow, steps, ct);
        steps = await _db.NovelSeedWorkflowSteps
            .Where(x => x.WorkflowId == workflowId)
            .OrderBy(x => x.SortOrder)
            .ToListAsync(ct);
        foreach (var step in steps)
        {
            step.Status = step.StepKey == "story" ? "ready" : "pending";
            step.IsConfirmed = false;
            step.Prompt = string.Empty;
            step.Output = string.Empty;
            step.Error = string.Empty;
            step.StartedAt = null;
            step.FinishedAt = null;
            step.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
        return ToDto(workflow, steps);
    }

    public async Task<NovelSeedWorkflowDto?> GetAsync(string workflowId, CancellationToken ct = default)
    {
        var workflow = await _db.NovelSeedWorkflows.AsNoTracking().FirstOrDefaultAsync(x => x.Id == workflowId, ct);
        if (workflow == null) return null;
        await EnsureWorkflowStepsAsync(workflowId, ct);
        var steps = await _db.NovelSeedWorkflowSteps.AsNoTracking()
            .Where(x => x.WorkflowId == workflowId)
            .OrderBy(x => x.SortOrder)
            .ToListAsync(ct);

        return ToDto(workflow, steps);
    }

    public async Task<IReadOnlyList<NovelSeedWorkflowDto>> ListAsync(int take = 20, CancellationToken ct = default)
    {
        var safeTake = Math.Clamp(take, 1, 100);
        var workflows = await _db.NovelSeedWorkflows.AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Take(safeTake)
            .ToListAsync(ct);
        if (workflows.Count == 0) return Array.Empty<NovelSeedWorkflowDto>();
        foreach (var workflow in workflows)
        {
            await EnsureWorkflowStepsAsync(workflow.Id, ct);
        }

        var workflowIds = workflows.Select(x => x.Id).ToList();
        var steps = await _db.NovelSeedWorkflowSteps.AsNoTracking()
            .Where(x => workflowIds.Contains(x.WorkflowId))
            .OrderBy(x => x.SortOrder)
            .ToListAsync(ct);
        var stepMap = steps.GroupBy(x => x.WorkflowId)
            .ToDictionary(x => x.Key, x => (IReadOnlyList<NovelSeedWorkflowStep>)x.ToList());

        return workflows
            .Select(x => ToDto(x, stepMap.TryGetValue(x.Id, out var workflowSteps)
                ? workflowSteps
                : Array.Empty<NovelSeedWorkflowStep>()))
            .ToList();
    }

    public async Task<NovelSeedWorkflowStepDto> RunStepAsync(string workflowId, string stepKey, CancellationToken ct = default)
    {
        var workflow = await _db.NovelSeedWorkflows.FirstOrDefaultAsync(x => x.Id == workflowId, ct)
            ?? throw new InvalidOperationException("AI 开书工作流不存在。");
        await EnsureWorkflowStepsAsync(workflow, ct);
        var step = await _db.NovelSeedWorkflowSteps.FirstOrDefaultAsync(x => x.WorkflowId == workflowId && x.StepKey == stepKey, ct)
            ?? throw new InvalidOperationException("工作流步骤不存在。");
        var request = DeserializeRequest(workflow.RequestJson);

        step.Status = "running";
        step.StartedAt = DateTime.UtcNow;
        step.FinishedAt = null;
        step.Error = string.Empty;
        workflow.Status = "running";
        await _db.SaveChangesAsync(ct);

        try
        {
            if (step.StepKey == "finalize")
            {
                var runId = WorkflowRunId(workflow, request, step.StepKey);
                var result = await FinalizeWorkflowAsync(workflowId, request, runId, ct);
                workflow.ProjectId = result.Project.Id;
                workflow.Status = "completed";
                step.Output = $"项目已生成：{result.Project.Name}\n项目 ID：{result.Project.Id}\n章节计划：{result.ChapterPlanCount}\n章节蓝图：{result.ChapterBlueprintCount}\n伏笔：{result.ForeshadowingCount}\n时间线：{result.TimelineCount}";
                await PublishWorkflowEventAsync(runId, "workflow.finalize.completed", "落库完成，正式项目数据已写入。", new
                {
                    step = 5,
                    total = 5,
                    projectId = result.Project.Id,
                    projectName = result.Project.Name,
                    result.ChapterPlanCount,
                    result.ChapterBlueprintCount,
                    result.ForeshadowingCount,
                    result.TimelineCount
                }, ct);
                await _notifier.CompletedAsync(runId, "finalized", ct);
            }
            else
            {
                var prompt = BuildStepPrompt(request, step.StepKey, await LoadPreviousOutputsAsync(workflowId, step.SortOrder, ct));
                var apiKey = await ResolveApiKeyAsync(request, ct);
                var runId = WorkflowRunId(workflow, request, step.StepKey);
                var maxTokens = Math.Min(request.MaxTokens ?? 4000, 5000);
                var result = await _ai.StreamAsync(new AiTestRequest
                {
                    RunId = runId,
                    Endpoint = request.Endpoint,
                    ApiKey = apiKey,
                    Model = request.Model,
                    Prompt = prompt,
                    SystemPrompt = "你是长篇网文开书规划助手。只输出当前步骤产物，不要输出无关解释。",
                    Temperature = request.Temperature,
                    MaxTokens = maxTokens
                }, ct);
                step.Prompt = prompt;
                step.Output = result.Content ?? string.Empty;
                step.IsConfirmed = false;
                _db.PromptRunSnapshots.Add(new PromptRunSnapshot
                {
                    RunId = runId,
                    ProjectId = workflow.ProjectId ?? string.Empty,
                    WorkflowId = workflow.Id,
                    StepKey = step.StepKey,
                    Source = "novel_seed_workflow",
                    Model = request.Model,
                    Temperature = request.Temperature,
                    MaxTokens = maxTokens,
                    ContextHash = Sha256(prompt),
                    ContextSummary = Truncate(await BuildWorkflowContextSummaryAsync(workflowId, step.SortOrder, ct), 1600),
                    PromptSummary = Truncate(prompt, 1600),
                    OutputSummary = Truncate(step.Output, 800),
                    Success = true,
                    ElapsedMs = result.ElapsedMs
                });
            }

            step.Status = "completed";
            step.FinishedAt = DateTime.UtcNow;
            UnlockNextStep(workflowId, step.SortOrder);
            if (workflow.Status == "running") workflow.Status = "draft";
            await _db.SaveChangesAsync(ct);
            return ToDto(step);
        }
        catch (Exception ex)
        {
            step.Status = "failed";
            step.Error = ex.Message;
            step.FinishedAt = DateTime.UtcNow;
            workflow.Status = "failed";
            workflow.Error = ex.Message;
            await _db.SaveChangesAsync(ct);
            throw;
        }
    }

    public async Task DeleteAsync(string workflowId, CancellationToken ct = default)
    {
        var workflow = await _db.NovelSeedWorkflows.FirstOrDefaultAsync(x => x.Id == workflowId, ct)
            ?? throw new InvalidOperationException("AI 开书工作流不存在。");
        var steps = await _db.NovelSeedWorkflowSteps
            .Where(x => x.WorkflowId == workflowId)
            .ToListAsync(ct);
        _db.NovelSeedWorkflowSteps.RemoveRange(steps);
        _db.NovelSeedWorkflows.Remove(workflow);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<NovelSeedWorkflowStepDto> ConfirmStepAsync(
        string workflowId,
        string stepKey,
        bool confirmed,
        CancellationToken ct = default)
    {
        var step = await _db.NovelSeedWorkflowSteps
            .FirstOrDefaultAsync(x => x.WorkflowId == workflowId && x.StepKey == stepKey, ct)
            ?? throw new InvalidOperationException("工作流步骤不存在。");
        if (!string.Equals(step.Status, "completed", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("只有已完成步骤可以确认。");
        }

        step.IsConfirmed = confirmed;
        await _db.SaveChangesAsync(ct);
        return ToDto(step);
    }

    public async Task<NovelSeedWorkflowStepPreviewDto> GetStepPreviewAsync(
        string workflowId,
        string stepKey,
        CancellationToken ct = default)
    {
        var step = await _db.NovelSeedWorkflowSteps.AsNoTracking()
            .FirstOrDefaultAsync(x => x.WorkflowId == workflowId && x.StepKey == stepKey, ct)
            ?? throw new InvalidOperationException("工作流步骤不存在。");

        return new NovelSeedWorkflowStepPreviewDto
        {
            WorkflowId = workflowId,
            StepKey = stepKey,
            Status = step.Status,
            Items = BuildPreviewItems(step.StepKey, step.Output)
        };
    }

    public async Task<NovelSeedWorkflowStepDto> RewriteStepFragmentAsync(
        string workflowId,
        string stepKey,
        NovelSeedWorkflowStepRewriteRequest request,
        CancellationToken ct = default)
    {
        var workflow = await _db.NovelSeedWorkflows.FirstOrDefaultAsync(x => x.Id == workflowId, ct)
            ?? throw new InvalidOperationException("AI 开书工作流不存在。");
        var step = await _db.NovelSeedWorkflowSteps.FirstOrDefaultAsync(x => x.WorkflowId == workflowId && x.StepKey == stepKey, ct)
            ?? throw new InvalidOperationException("工作流步骤不存在。");
        if (!string.Equals(step.Status, "completed", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("只有已完成步骤可以重写片段。");
        }
        if (string.IsNullOrWhiteSpace(request.ItemKey))
        {
            throw new InvalidOperationException("片段 Key 不能为空。");
        }
        if (string.IsNullOrWhiteSpace(request.Instruction))
        {
            throw new InvalidOperationException("重写要求不能为空。");
        }

        var previewItems = BuildPreviewItems(step.StepKey, step.Output);
        var target = previewItems.FirstOrDefault(x => string.Equals(x.Key, request.ItemKey, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("指定片段不存在。");
        var seedRequest = DeserializeRequest(workflow.RequestJson);
        var prompt = string.Join('\n', new[]
        {
            "# 需要重写的开书片段",
            target.RawJson,
            "",
            "# 重写要求",
            request.Instruction,
            "",
            "# 输出要求",
            "只输出重写后的同结构 JSON 对象，不要输出 Markdown，不要解释。"
        });
        var apiKey = await ResolveApiKeyAsync(seedRequest, ct);
        var result = await _ai.CompleteAsync(new AiTestRequest
        {
            RunId = string.IsNullOrWhiteSpace(seedRequest.RunId) ? $"seed_{workflow.Id}_{step.StepKey}_rewrite" : seedRequest.RunId,
            Endpoint = seedRequest.Endpoint,
            ApiKey = apiKey,
            Model = seedRequest.Model,
            Prompt = prompt,
            SystemPrompt = "你是长篇网文开书规划助手，只重写用户指定的一个结构化片段。",
            Temperature = seedRequest.Temperature,
            MaxTokens = Math.Min(seedRequest.MaxTokens ?? 3000, 4000)
        }, ct);

        var rewritten = result.Content ?? string.Empty;
        step.Output = ReplacePreviewItem(step.StepKey, step.Output, request.ItemKey, rewritten);
        step.Prompt = prompt;
        step.IsConfirmed = false;
        step.UpdatedAt = DateTime.UtcNow;
        _db.PromptRunSnapshots.Add(new PromptRunSnapshot
        {
            RunId = string.IsNullOrWhiteSpace(seedRequest.RunId) ? $"seed_{workflow.Id}_{step.StepKey}_rewrite" : seedRequest.RunId,
            ProjectId = workflow.ProjectId ?? string.Empty,
            WorkflowId = workflow.Id,
            StepKey = step.StepKey,
            Source = "novel_seed_workflow_rewrite",
            Model = seedRequest.Model,
            Temperature = seedRequest.Temperature,
            MaxTokens = Math.Min(seedRequest.MaxTokens ?? 3000, 4000),
            ContextHash = Sha256(target.RawJson + "\n" + request.Instruction),
            ContextSummary = Truncate(target.RawJson, 1600),
            PromptSummary = Truncate(prompt, 1600),
            OutputSummary = Truncate(rewritten, 800),
            Success = true,
            ElapsedMs = result.ElapsedMs
        });
        await _db.SaveChangesAsync(ct);
        return ToDto(step);
    }

    private async Task<IReadOnlyList<NovelSeedWorkflowStep>> LoadPreviousOutputsAsync(
        string workflowId,
        int sortOrder,
        CancellationToken ct)
        => await _db.NovelSeedWorkflowSteps.AsNoTracking()
            .Where(x => x.WorkflowId == workflowId && x.SortOrder < sortOrder && x.Status == "completed")
            .OrderBy(x => x.SortOrder)
            .ToListAsync(ct);

    private async Task EnsureWorkflowStepsAsync(string workflowId, CancellationToken ct)
    {
        var workflow = await _db.NovelSeedWorkflows.FirstOrDefaultAsync(x => x.Id == workflowId, ct);
        if (workflow == null) return;
        await EnsureWorkflowStepsAsync(workflow, ct);
    }

    private async Task EnsureWorkflowStepsAsync(NovelSeedWorkflow workflow, CancellationToken ct)
    {
        var steps = await _db.NovelSeedWorkflowSteps
            .Where(x => x.WorkflowId == workflow.Id)
            .OrderBy(x => x.SortOrder)
            .ToListAsync(ct);
        await EnsureWorkflowStepsAsync(workflow, steps, ct);
    }

    private async Task EnsureWorkflowStepsAsync(
        NovelSeedWorkflow workflow,
        IReadOnlyList<NovelSeedWorkflowStep> existingSteps,
        CancellationToken ct)
    {
        var changed = false;
        var stepMap = existingSteps.ToDictionary(x => x.StepKey, StringComparer.OrdinalIgnoreCase);

        for (var i = 0; i < Steps.Length; i++)
        {
            var definition = Steps[i];
            if (stepMap.TryGetValue(definition.Key, out var step))
            {
                if (step.Title != definition.Title)
                {
                    step.Title = definition.Title;
                    changed = true;
                }

                if (step.SortOrder != definition.SortOrder)
                {
                    step.SortOrder = definition.SortOrder;
                    changed = true;
                }

                continue;
            }

            var previousCompleted = i == 0 || stepMap.TryGetValue(Steps[i - 1].Key, out var previous)
                && string.Equals(previous.Status, "completed", StringComparison.OrdinalIgnoreCase);
            var status = i == 0 || previousCompleted ? "ready" : "pending";
            var added = new NovelSeedWorkflowStep
            {
                WorkflowId = workflow.Id,
                StepKey = definition.Key,
                Title = definition.Title,
                SortOrder = definition.SortOrder,
                Status = status
            };
            _db.NovelSeedWorkflowSteps.Add(added);
            stepMap[definition.Key] = added;
            changed = true;
        }

        if (!changed) return;

        workflow.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    private async Task<NovelSeedResult> FinalizeWorkflowAsync(
        string workflowId,
        NovelSeedRequest request,
        string runId,
        CancellationToken ct)
    {
        await _notifier.StatusAsync(runId, "finalizing", ct);
        await PublishWorkflowEventAsync(runId, "workflow.finalize.started", "开始落库生成项目。", new
        {
            step = 1,
            total = 5
        }, ct);

        var outputs = await LoadPreviousOutputsAsync(workflowId, int.MaxValue, ct);
        var confirmedCount = outputs.Count(x => x.IsConfirmed);
        await PublishWorkflowEventAsync(runId, "workflow.finalize.outputs_loaded", $"已读取 {outputs.Count} 个步骤产物，其中 {confirmedCount} 个已确认。", new
        {
            step = 2,
            total = 5,
            outputCount = outputs.Count,
            confirmedCount
        }, ct);

        if (_novelSeedDirect != null && TryBuildMergedPlanJson(outputs, out var rawPlan))
        {
            await PublishWorkflowEventAsync(runId, "workflow.finalize.plan_parsed", "已从步骤产物解析出结构化开书计划，开始写入数据库。", new
            {
                step = 3,
                total = 5,
                mode = "raw_plan"
            }, ct);

            var result = await _novelSeedDirect.CreateFromRawPlanAsync(request, rawPlan, ct);
            await PublishWorkflowEventAsync(runId, "workflow.finalize.database_saved", "项目、素材、章节计划和章节蓝图已保存。", new
            {
                step = 4,
                total = 5,
                projectId = result.Project.Id,
                projectName = result.Project.Name,
                result.ChapterPlanCount,
                result.ChapterBlueprintCount,
                result.ForeshadowingCount,
                result.TimelineCount
            }, ct);
            return result;
        }

        await PublishWorkflowEventAsync(runId, "workflow.finalize.replanning", "步骤产物未解析出完整 JSON，正在调用开书兜底生成。", new
        {
            step = 3,
            total = 5,
            mode = "fallback_ai"
        }, ct);

        var fallback = await _novelSeed.GenerateAsync(request, ct);
        await PublishWorkflowEventAsync(runId, "workflow.finalize.database_saved", "兜底开书结果已写入数据库。", new
        {
            step = 4,
            total = 5,
            projectId = fallback.Project.Id,
            projectName = fallback.Project.Name,
            fallback.ChapterPlanCount,
            fallback.ChapterBlueprintCount,
            fallback.ForeshadowingCount,
            fallback.TimelineCount
        }, ct);
        return fallback;
    }

    private static string WorkflowRunId(NovelSeedWorkflow workflow, NovelSeedRequest request, string stepKey)
        => string.IsNullOrWhiteSpace(request.RunId) ? $"seed_{workflow.Id}_{stepKey}" : request.RunId;

    private Task PublishWorkflowEventAsync(string runId, string type, string message, object data, CancellationToken ct)
        => _notifier.EventAsync(runId, new ChatRunEventDto(type, message, DateTime.UtcNow, data), ct);

    private void UnlockNextStep(string workflowId, int sortOrder)
    {
        var next = _db.NovelSeedWorkflowSteps
            .Where(x => x.WorkflowId == workflowId && x.SortOrder > sortOrder)
            .OrderBy(x => x.SortOrder)
            .FirstOrDefault();
        if (next is { Status: "pending" })
        {
            next.Status = "ready";
        }
    }

    private async Task<string> ResolveApiKeyAsync(NovelSeedRequest request, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(request.ApiKeyId))
        {
            return await _apiKeys.GetPlainKeyAsync(request.ApiKeyId, ct)
                   ?? throw new InvalidOperationException("指定 API Key 不存在。");
        }

        if (!string.IsNullOrWhiteSpace(request.ProviderId))
        {
            return await _apiKeys.RotateNextPlainKeyAsync(request.ProviderId, ct)
                   ?? throw new InvalidOperationException("当前 Provider 没有可用 API Key。");
        }

        if (!string.IsNullOrWhiteSpace(request.ConfigId))
        {
            return await _apiKeys.RotateNextPlainKeyAsync(request.ConfigId, ct)
                   ?? throw new InvalidOperationException("当前配置没有可用 API Key。");
        }

        if (!string.IsNullOrWhiteSpace(request.ApiKey)) return request.ApiKey;
        throw new InvalidOperationException("请选择已保存的 API Key，或填写临时 API Key。");
    }

    private static string BuildStepPrompt(
        NovelSeedRequest request,
        string stepKey,
        IReadOnlyList<NovelSeedWorkflowStep> previous)
    {
        var previousText = previous.Count == 0
            ? "无"
            : string.Join("\n\n", previous.Select(x => $"## {x.Title}\n{x.Output}"));
        var target = stepKey switch
        {
            "story" => "生成约 3000 字以内的整书压缩故事，覆盖开端、升级、中段转折、后段高潮和终局。",
            "metadata" => "基于前文生成核心种子、小说元信息、终局承诺、核心卖点和不可改写设定。",
            "volumes" => $"规划 {request.VolumeCount} 卷，每卷给出卷标题、阶段目标、主敌对力量、高潮事件、结束状态。",
            "chapters" => $"规划前 {request.InitialChapterPlanCount} 章章节卡，要求每章标题、简介、核心事件不重复；每章尽量给出 foreshadowingName、foreshadowingTier、foreshadowingRole、temporalAnchor、timelineCoordinate，方便下一步生成伏笔账本和时间线。",
            "tracking" => """
                基于前面整书压缩故事、元信息、分卷蓝图和前期章节卡，生成可落库的伏笔账本和时间线。
                只输出 JSON，不要 Markdown，不要解释。结构如下：
                {
                  "foreshadowings": [
                    {
                      "name": "伏笔名称",
                      "tier": "Tier-1/Tier-2/Tier-3",
                      "setupChapter": 1,
                      "payoffChapter": 12,
                      "role": "它在长篇里的职责",
                      "description": "埋设、推进、回收方式说明"
                    }
                  ],
                  "timelines": [
                    {
                      "chapterNumber": 1,
                      "timePeriod": "时间段",
                      "elapsedTime": "距上一章经过多久",
                      "keyTimeEvent": "本章对主线/伏笔/角色状态造成的关键变化",
                      "importance": "high/normal/low"
                    }
                  ]
                }
                要求：foreshadowings 至少 3 条，覆盖主线伏笔、角色秘密、世界规则或关键物品；timelines 必须覆盖已规划的代表性章节，并按 chapterNumber 排序。
                """,
            _ => "生成当前步骤需要的开书资料。"
        };

        return string.Join('\n', new[]
        {
            "# 用户开书描述",
            request.Description,
            "",
            "# 基础参数",
            $"题材：{request.Genre}",
            $"基调：{request.Tone}",
            $"目标读者：{request.TargetAudience}",
            $"卷数：{request.VolumeCount}",
            $"每卷章节：{request.ChaptersPerVolume}",
            $"章均字数：{request.EstimatedWordsPerChapter}",
            "",
            "# 已完成步骤",
            previousText,
            "",
            "# 当前任务",
            target
        });
    }

    private static NovelSeedRequest DeserializeRequest(string json)
        => JsonSerializer.Deserialize<NovelSeedRequest>(json, JsonOptions) ?? new NovelSeedRequest();

    private static bool TryExtractJson(string text, out string json)
    {
        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        if (start >= 0 && end > start)
        {
            json = text[start..(end + 1)];
            return true;
        }

        json = string.Empty;
        return false;
    }

    private static bool TryBuildMergedPlanJson(IReadOnlyList<NovelSeedWorkflowStep> outputs, out string json)
    {
        var objects = outputs
            .Select(x => TryParseJsonObject(x.Output))
            .Where(x => x != null)
            .Cast<JsonObject>()
            .ToList();

        var basePlan = objects.FirstOrDefault(IsCompletePlanObject);
        if (basePlan == null)
        {
            var merged = string.Join("\n\n", outputs.Select(x => x.Output).Where(x => !string.IsNullOrWhiteSpace(x)));
            return TryExtractJson(merged, out json);
        }

        var mergeKeys = new[]
        {
            "projectTitle",
            "logline",
            "genre",
            "theme",
            "tone",
            "world",
            "characters",
            "factions",
            "locations",
            "volumes",
            "chapters",
            "foreshadowings",
            "timelines"
        };

        foreach (var obj in objects)
        {
            foreach (var key in mergeKeys)
            {
                if (!obj.TryGetPropertyValue(key, out var value) || value == null) continue;
                if (!basePlan.ContainsKey(key) || key is "foreshadowings" or "timelines")
                {
                    basePlan[key] = value.DeepClone();
                }
            }
        }

        json = basePlan.ToJsonString(JsonOptions);
        return true;
    }

    private static JsonObject? TryParseJsonObject(string output)
    {
        if (!TryExtractJson(output, out var json)) return null;
        try
        {
            return JsonNode.Parse(json) as JsonObject;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static bool IsCompletePlanObject(JsonObject obj)
        => obj.ContainsKey("projectTitle")
           && obj.ContainsKey("world")
           && obj.ContainsKey("chapters");

    private static IReadOnlyList<NovelSeedWorkflowPreviewItemDto> BuildPreviewItems(string stepKey, string output)
    {
        if (string.IsNullOrWhiteSpace(output)) return Array.Empty<NovelSeedWorkflowPreviewItemDto>();
        if (!TryExtractJson(output, out var json)) return BuildMarkdownPreviewItems(output);

        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            if (stepKey == "tracking" && root.ValueKind == JsonValueKind.Object)
            {
                return BuildTrackingPreviewItems(root);
            }

            var arrayName = stepKey switch
            {
                "volumes" => "volumes",
                "chapters" => "chapters",
                _ => string.Empty
            };
            if (!string.IsNullOrWhiteSpace(arrayName)
                && root.ValueKind == JsonValueKind.Object
                && root.TryGetProperty(arrayName, out var array)
                && array.ValueKind == JsonValueKind.Array)
            {
                return array.EnumerateArray()
                    .Select((item, index) => BuildJsonPreviewItem(arrayName, index, item))
                    .ToList();
            }

            if (root.ValueKind == JsonValueKind.Object)
            {
                return root.EnumerateObject()
                    .Select(property => new NovelSeedWorkflowPreviewItemDto
                    {
                        Key = property.Name,
                        Title = property.Name,
                        Summary = Truncate(JsonElementSummary(property.Value), 260),
                        RawJson = property.Value.GetRawText()
                    })
                    .ToList();
            }
        }
        catch (JsonException)
        {
            return BuildMarkdownPreviewItems(output);
        }

        return BuildMarkdownPreviewItems(output);
    }

    private static IReadOnlyList<NovelSeedWorkflowPreviewItemDto> BuildTrackingPreviewItems(JsonElement root)
    {
        var items = new List<NovelSeedWorkflowPreviewItemDto>();
        if (root.TryGetProperty("foreshadowings", out var foreshadowings)
            && foreshadowings.ValueKind == JsonValueKind.Array)
        {
            items.AddRange(foreshadowings.EnumerateArray().Select((item, index) =>
            {
                var name = FirstNonEmpty(TryGetString(item, "name"), $"伏笔 {index + 1}");
                var tier = TryGetString(item, "tier");
                var role = FirstNonEmpty(TryGetString(item, "role"), TryGetString(item, "description"));
                return new NovelSeedWorkflowPreviewItemDto
                {
                    Key = $"foreshadowings[{index}]",
                    Title = $"{name}{(string.IsNullOrWhiteSpace(tier) ? string.Empty : $" / {tier}")}",
                    Summary = Truncate(role, 300),
                    RawJson = item.GetRawText()
                };
            }));
        }

        if (root.TryGetProperty("timelines", out var timelines)
            && timelines.ValueKind == JsonValueKind.Array)
        {
            items.AddRange(timelines.EnumerateArray().Select((item, index) =>
            {
                var chapter = FirstNonEmpty(TryGetString(item, "chapterNumber"), (index + 1).ToString());
                var timePeriod = FirstNonEmpty(TryGetString(item, "timePeriod"), $"第{chapter}章时间线");
                var summary = FirstNonEmpty(TryGetString(item, "keyTimeEvent"), TryGetString(item, "elapsedTime"));
                return new NovelSeedWorkflowPreviewItemDto
                {
                    Key = $"timelines[{index}]",
                    Title = $"第{chapter}章 {timePeriod}",
                    Summary = Truncate(summary, 300),
                    RawJson = item.GetRawText()
                };
            }));
        }

        return items;
    }

    private static NovelSeedWorkflowPreviewItemDto BuildJsonPreviewItem(string arrayName, int index, JsonElement item)
    {
        var number = TryGetString(item, "number");
        var title = TryGetString(item, "title");
        var summary = FirstNonEmpty(TryGetString(item, "summary"), TryGetString(item, "stageGoal"), TryGetString(item, "coreEvent"), JsonElementSummary(item));
        return new NovelSeedWorkflowPreviewItemDto
        {
            Key = $"{arrayName}[{index}]",
            Title = arrayName == "chapters"
                ? $"第{FirstNonEmpty(number, (index + 1).ToString())}章 {FirstNonEmpty(title, "未命名章节")}"
                : $"第{FirstNonEmpty(number, (index + 1).ToString())}卷 {FirstNonEmpty(title, "未命名分卷")}",
            Summary = Truncate(summary, 300),
            RawJson = item.GetRawText()
        };
    }

    private static IReadOnlyList<NovelSeedWorkflowPreviewItemDto> BuildMarkdownPreviewItems(string output)
        => output.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(x => x.StartsWith('#') || x.StartsWith("- ") || x.StartsWith("1.") || x.StartsWith("2.") || x.StartsWith("3."))
            .Take(30)
            .Select((line, index) => new NovelSeedWorkflowPreviewItemDto
            {
                Key = $"line[{index}]",
                Title = Truncate(line.TrimStart('#', '-', ' ', '\t'), 80),
                Summary = Truncate(line, 260),
                RawJson = JsonSerializer.Serialize(new { text = line }, JsonOptions)
            })
            .ToList();

    private static string ReplacePreviewItem(string stepKey, string output, string itemKey, string rewritten)
    {
        if (!TryExtractJson(output, out var json)
            || !TryExtractJson(rewritten, out var rewrittenJson)
            || !TryParseArrayKey(itemKey, out var arrayName, out var index))
        {
            return $"{output.Trim()}\n\n## 片段重写补丁 {itemKey}\n{rewritten.Trim()}";
        }

        try
        {
            using var sourceDoc = JsonDocument.Parse(json);
            using var rewrittenDoc = JsonDocument.Parse(rewrittenJson);
            if (sourceDoc.RootElement.ValueKind != JsonValueKind.Object
                || !sourceDoc.RootElement.TryGetProperty(arrayName, out var array)
                || array.ValueKind != JsonValueKind.Array
                || index < 0
                || index >= array.GetArrayLength())
            {
                return $"{output.Trim()}\n\n## 片段重写补丁 {itemKey}\n{rewritten.Trim()}";
            }

            var map = sourceDoc.RootElement.EnumerateObject()
                .ToDictionary(x => x.Name, x => x.Value.Clone(), StringComparer.OrdinalIgnoreCase);
            var items = array.EnumerateArray().Select(x => x.Clone()).ToList();
            items[index] = rewrittenDoc.RootElement.Clone();
            map[arrayName] = JsonSerializer.SerializeToElement(items, JsonOptions);
            return JsonSerializer.Serialize(map, new JsonSerializerOptions(JsonSerializerDefaults.Web)
            {
                WriteIndented = true,
                Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
            });
        }
        catch (JsonException)
        {
            return $"{output.Trim()}\n\n## 片段重写补丁 {itemKey}\n{rewritten.Trim()}";
        }
    }

    private static bool TryParseArrayKey(string value, out string arrayName, out int index)
    {
        arrayName = string.Empty;
        index = -1;
        var left = value.IndexOf('[');
        var right = value.IndexOf(']');
        if (left <= 0 || right <= left) return false;
        arrayName = value[..left];
        return int.TryParse(value[(left + 1)..right], out index);
    }

    private static string TryGetString(JsonElement element, string property)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(property, out var value))
        {
            return string.Empty;
        }

        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString() ?? string.Empty,
            JsonValueKind.Number => value.ToString(),
            _ => string.Empty
        };
    }

    private static string JsonElementSummary(JsonElement element)
        => element.ValueKind == JsonValueKind.Object
            ? string.Join("；", element.EnumerateObject().Take(6).Select(x => $"{x.Name}:{Truncate(x.Value.ToString(), 80)}"))
            : element.ToString();

    private async Task<string> BuildWorkflowContextSummaryAsync(string workflowId, int sortOrder, CancellationToken ct)
    {
        var previous = await LoadPreviousOutputsAsync(workflowId, sortOrder, ct);
        return previous.Count == 0
            ? "无上一步产物。"
            : string.Join("\n\n", previous.Select(x => $"## {x.Title}\n{Truncate(x.Output, 800)}"));
    }

    private static void ValidateRequest(NovelSeedRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Description)) throw new InvalidOperationException("小说描述不能为空。");
        if (string.IsNullOrWhiteSpace(request.Endpoint)) throw new InvalidOperationException("Endpoint 不能为空。");
        if (string.IsNullOrWhiteSpace(request.Model)) throw new InvalidOperationException("模型不能为空。");
    }

    private static NovelSeedWorkflowDto ToDto(NovelSeedWorkflow workflow, IReadOnlyList<NovelSeedWorkflowStep> steps)
        => new(
            workflow.Id,
            workflow.Status,
            DeserializeRequest(workflow.RequestJson),
            workflow.ProjectId,
            string.IsNullOrWhiteSpace(workflow.Error) ? null : workflow.Error,
            steps.Select(ToDto).ToList(),
            workflow.CreatedAt,
            workflow.UpdatedAt);

    private static NovelSeedWorkflowStepDto ToDto(NovelSeedWorkflowStep step)
        => new(
            step.Id,
            step.WorkflowId,
            step.StepKey,
            step.Title,
            step.SortOrder,
            step.Status,
            step.IsConfirmed,
            step.Prompt,
            step.Output,
            string.IsNullOrWhiteSpace(step.Error) ? null : step.Error,
            step.StartedAt,
            step.FinishedAt,
            step.CreatedAt,
            step.UpdatedAt);

    private static string Sha256(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string Truncate(string? value, int maxChars)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var normalized = value.Trim();
        return normalized.Length <= maxChars ? normalized : normalized[..maxChars] + "...";
    }

    private static string FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim() ?? string.Empty;

    private sealed record StepDefinition(string Key, string Title, int SortOrder);
}
