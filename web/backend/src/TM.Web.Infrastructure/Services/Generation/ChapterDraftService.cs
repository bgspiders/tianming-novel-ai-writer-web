using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TM.Web.Application.Dtos;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;
using TM.Web.Domain.Common;
using TM.Web.Domain.Entities.Core;
using TM.Web.Domain.Entities.Runtime;
using TM.Web.Domain.Entities.Validation;
using TM.Web.Infrastructure.Persistence;
using TM.Web.Infrastructure.Services.Validation;

namespace TM.Web.Infrastructure.Services.Generation;

public class ChapterDraftService : IChapterDraftService
{
    private const int MaxRecallContextChars = 2800;
    private const int MaxRecallFieldChars = 300;
    private const int MaxRecallItems = 6;

    private readonly IAiCompletionService _ai;
    private readonly IAiApiKeyService _apiKeys;
    private readonly IChapterService _chapters;
    private readonly IEditorService _editor;
    private readonly IGenerationGateService _generationGate;
    private readonly GenerationStateService _generationState;
    private readonly IValidationService _validation;
    private readonly AppDbContext _db;
    private readonly ILogger<ChapterDraftService> _logger;

    public ChapterDraftService(
        IAiCompletionService ai,
        IAiApiKeyService apiKeys,
        IChapterService chapters,
        IEditorService editor,
        IGenerationGateService generationGate,
        GenerationStateService generationState,
        IValidationService validation,
        AppDbContext db,
        ILogger<ChapterDraftService> logger)
    {
        _ai = ai;
        _apiKeys = apiKeys;
        _chapters = chapters;
        _editor = editor;
        _generationGate = generationGate;
        _generationState = generationState;
        _validation = validation;
        _db = db;
        _logger = logger;
    }

    public async Task<ChapterDraftResult> GenerateDraftAsync(ChapterDraftRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.ChapterId))
            throw new InvalidOperationException("章节 ID 不能为空。");
        if (string.IsNullOrWhiteSpace(request.ProjectId))
            throw new InvalidOperationException("项目 ID 不能为空。");

        var chapter = await _db.Chapters.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.ChapterId, ct)
                      ?? throw new InvalidOperationException("章节不存在。");
        if (chapter.ProjectId != request.ProjectId)
            throw new InvalidOperationException("章节不属于当前项目。");
        if (!string.IsNullOrWhiteSpace(request.VolumeId) && chapter.VolumeId != request.VolumeId)
            throw new InvalidOperationException("章节不属于当前分卷。");

        var startedAt = DateTime.UtcNow;
        var record = new GenerationRecord
        {
            ProjectId = request.ProjectId,
            ChapterId = request.ChapterId,
            Success = false,
            TotalAttempts = 1,
            RewriteCount = 0,
            FailureStages = "[]",
            StartedAt = startedAt
        };
        _db.GenerationRecords.Add(record);
        await _db.SaveChangesAsync(ct);

        AiTestResult? result = null;
        try
        {
            var attempts = new List<GenerationAttemptLog>();
            var maxRewriteAttempts = Math.Clamp(request.MaxRewriteAttempts, 0, 3);
            var basePrompt = await BuildPromptWithPlanningContextAsync(request.Prompt, chapter, ct);
            basePrompt = await AppendValidationRepairContextAsync(basePrompt, request.ValidationReportId, request.ChapterId, ct);
            var prompt = basePrompt;
            GenerationGateResultDto? passedGate = null;
            string content = string.Empty;
            var apiKey = await ResolveApiKeyAsync(request, ct);

            for (var attempt = 1; attempt <= maxRewriteAttempts + 1; attempt++)
            {
                result = await _ai.StreamAsync(new AiTestRequest
                {
                    RunId = request.RunId,
                    Endpoint = request.Endpoint,
                    ApiKey = apiKey,
                    Model = request.Model,
                    Prompt = prompt,
                    SystemPrompt = request.SystemPrompt,
                    Temperature = request.Temperature,
                    MaxTokens = request.MaxTokens
                }, ct);

                content = result.Content ?? string.Empty;
                var gateInput = await _generationState.BuildGateRequestAsync(request.ProjectId, request.ChapterId, content, ct);
                var gateResult = await _generationGate.ValidateAsync(gateInput, ct);
                attempts.Add(GenerationAttemptLog.From(attempt, result, gateResult));

                if (gateResult.Success)
                {
                    passedGate = gateResult;
                    break;
                }

                if (attempt <= maxRewriteAttempts)
                {
                    prompt = BuildRewritePrompt(basePrompt, content, gateResult.AllFailures);
                }
            }

            if (passedGate == null)
            {
                var failureStages = attempts
                    .SelectMany(x => x.Gate.FailureStages.Count == 0
                        ? (IEnumerable<string>)new[] { "generation_gate" }
                        : x.Gate.FailureStages)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                record.Success = false;
                record.TotalAttempts = attempts.Count;
                record.RewriteCount = Math.Max(0, attempts.Count - 1);
                record.FinishedAt = DateTime.UtcNow;
                record.FailureStages = JsonSerializer.Serialize<IReadOnlyList<string>>(failureStages);
                record.Attempts = JsonSerializer.Serialize(attempts);
                await UpdateStatisticsAsync(request.ProjectId, success: false, rewriteCount: record.RewriteCount, ct);
                await _db.SaveChangesAsync(ct);

                var failures = attempts.LastOrDefault()?.Gate.AllFailures ?? new List<string>();
                throw new GenerationGateFailedException("生成门禁未通过：" + string.Join("；", failures.Take(5)));
            }

            var finalResult = result ?? throw new InvalidOperationException("生成结果为空。");
            var contentToSave = passedGate.ContentWithoutChanges ?? content;
            var savedChapter = request.SaveToChapter
                ? await _chapters.SaveContentAsync(request.ChapterId, contentToSave, "drafted", ct)
                : null;

            var sourceBookId = await _db.Projects.AsNoTracking()
                .Where(p => p.Id == request.ProjectId)
                .Select(p => p.CurrentSourceBookId)
                .FirstOrDefaultAsync(ct);
            await _generationState.ApplyParsedChangesAsync(request.ProjectId, sourceBookId, request.ChapterId, passedGate.ParsedChangesJson, ct);

            if (request.SaveToChapter && request.RerunValidationAfterSave)
            {
                var volume = await _db.Volumes.AsNoTracking().FirstOrDefaultAsync(v => v.Id == chapter.VolumeId, ct);
                await _validation.RunAsync(new TM.Web.Application.Dtos.Validation.ValidationRunRequest(
                    request.ProjectId,
                    volume?.VolumeNumber), ct);
            }

            record.Success = true;
            record.TotalAttempts = attempts.Count;
            record.RewriteCount = Math.Max(0, attempts.Count - 1);
            record.FinishedAt = DateTime.UtcNow;
            record.Attempts = JsonSerializer.Serialize(attempts.Select(x => x with { Saved = x.Attempt == attempts.Count && request.SaveToChapter }).ToList());
            await UpdateStatisticsAsync(request.ProjectId, success: true, rewriteCount: record.RewriteCount, ct);
            await _db.SaveChangesAsync(ct);

            _logger.LogInformation(
                "Chapter draft generated. chapterId={ChapterId} runId={RunId} chars={Chars} saved={Saved}",
                request.ChapterId, request.RunId, finalResult.CharCount, request.SaveToChapter);

            return new ChapterDraftResult
            {
                RunId = finalResult.RunId,
                Model = finalResult.Model,
                ChunkCount = finalResult.ChunkCount,
                CharCount = finalResult.CharCount,
                FinishReason = finalResult.FinishReason,
                ElapsedMs = finalResult.ElapsedMs,
                ChapterId = request.ChapterId,
                WordCount = savedChapter?.WordCount ?? CountWords(contentToSave),
                ContentFilePath = savedChapter?.ContentFilePath ?? chapter.ContentFilePath,
                SavedToChapter = request.SaveToChapter,
                GenerationRecordId = record.Id
            };
        }
        catch (GenerationGateFailedException)
        {
            throw;
        }
        catch (Exception ex)
        {
            record.Success = false;
            record.FinishedAt = DateTime.UtcNow;
            record.FailureStages = JsonSerializer.Serialize(new[] { "ai_stream" });
            record.Attempts = JsonSerializer.Serialize(new[]
            {
                new
                {
                    attempt = 1,
                    runId = request.RunId,
                    model = request.Model,
                    error = ex.Message,
                    chunkCount = result?.ChunkCount ?? 0,
                    charCount = result?.CharCount ?? 0,
                    elapsedMs = result?.ElapsedMs ?? (long)(DateTime.UtcNow - startedAt).TotalMilliseconds
                }
            });
            await UpdateStatisticsAsync(request.ProjectId, success: false, rewriteCount: 0, CancellationToken.None);
            await _db.SaveChangesAsync(CancellationToken.None);
            throw;
        }
    }

    private async Task UpdateStatisticsAsync(string projectId, bool success, int rewriteCount, CancellationToken ct)
    {
        var stats = await _db.GenerationStatistics.FirstOrDefaultAsync(s => s.ProjectId == projectId, ct);
        if (stats == null)
        {
            stats = new GenerationStatistics { ProjectId = projectId };
            _db.GenerationStatistics.Add(stats);
        }

        stats.TotalGenerations++;
        stats.RewriteCount += rewriteCount;
        if (success)
        {
            if (rewriteCount == 0) stats.FirstPassCount++;
        }
        else
        {
            stats.FailureCount++;
        }
        stats.LastUpdatedAt = DateTime.UtcNow;
    }

    private static int CountWords(string? content)
        => string.IsNullOrWhiteSpace(content)
            ? 0
            : content.Count(c => !char.IsWhiteSpace(c));

    private async Task<string> BuildPromptWithPlanningContextAsync(
        string userPrompt,
        Chapter chapter,
        CancellationToken ct)
    {
        var sourceBookId = await _db.Projects.AsNoTracking()
            .Where(p => p.Id == chapter.ProjectId)
            .Select(p => p.CurrentSourceBookId)
            .FirstOrDefaultAsync(ct);

        var chapterPlan = await FilterBySourceBook(
                _db.ChapterPlans.AsNoTracking().Where(x => x.IsEnabled),
                sourceBookId)
            .Where(x => x.ChapterNumber == chapter.ChapterNumber)
            .OrderByDescending(x => x.UpdatedAt)
            .FirstOrDefaultAsync(ct);

        var blueprints = await FilterBySourceBook(
                _db.ChapterBlueprints.AsNoTracking().Where(x => x.IsEnabled),
                sourceBookId)
            .Where(x => x.ChapterId == chapter.Id)
            .OrderBy(x => x.SceneNumber)
            .ThenBy(x => x.SceneTitle)
            .ToListAsync(ct);

        var contextLines = new List<string>();
        if (chapterPlan != null)
        {
            contextLines.AddRange(new[]
            {
                "# 自动召回的章节规划上下文（优先遵守）",
                "## ChapterPlan",
                PromptLine("章节标题", chapterPlan.ChapterTitle),
                PromptLine("预计字数", chapterPlan.EstimatedWordCount),
                PromptLine("章节主题", chapterPlan.ChapterTheme),
                PromptLine("读者体验目标", chapterPlan.ReaderExperienceGoal),
                PromptLine("主目标", chapterPlan.MainGoal),
                PromptLine("阻力来源", chapterPlan.ResistanceSource),
                PromptLine("关键转折", chapterPlan.KeyTurn),
                PromptLine("章节钩子", chapterPlan.Hook),
                PromptLine("世界信息投放", chapterPlan.WorldInfoDrop),
                PromptLine("人物弧光推进", chapterPlan.CharacterArcProgress),
                PromptLine("主线推进", chapterPlan.MainPlotProgress),
                PromptLine("伏笔安排", chapterPlan.Foreshadowing),
                PromptLine("出场角色", JoinList(chapterPlan.ReferencedCharacterNames)),
                PromptLine("出场势力", JoinList(chapterPlan.ReferencedFactionNames)),
                PromptLine("出场地点", JoinList(chapterPlan.ReferencedLocationNames))
            }.Where(x => !string.IsNullOrWhiteSpace(x))!);
        }

        if (blueprints.Count > 0)
        {
            if (contextLines.Count == 0)
            {
                contextLines.Add("# 自动召回的章节规划上下文（优先遵守）");
            }

            contextLines.Add("## ChapterBlueprint");
            foreach (var blueprint in blueprints.Take(12))
            {
                contextLines.AddRange(new[]
                {
                    $"### 场景 {blueprint.SceneNumber}: {FirstNonEmpty(blueprint.SceneTitle, blueprint.Name)}",
                    PromptLine("一句话结构", blueprint.OneLineStructure),
                    PromptLine("节奏曲线", blueprint.PacingCurve),
                    PromptLine("POV", blueprint.PovCharacter),
                    PromptLine("预计字数", blueprint.EstimatedWordCount),
                    PromptLine("开场", blueprint.Opening),
                    PromptLine("发展", blueprint.Development),
                    PromptLine("转折", blueprint.Turning),
                    PromptLine("收束", blueprint.Ending),
                    PromptLine("信息投放", blueprint.InfoDrop),
                    PromptLine("出场角色", blueprint.Cast),
                    PromptLine("地点", blueprint.Locations),
                    PromptLine("势力", blueprint.Factions),
                    PromptLine("道具/线索", blueprint.ItemsClues)
                }.Where(x => !string.IsNullOrWhiteSpace(x))!);
            }
        }

        await AppendRelatedChapterContextAsync(contextLines, chapter, ct);

        if (contextLines.Count == 0)
        {
            return userPrompt;
        }

        return string.Join("\n", new[]
        {
            string.Join("\n", contextLines),
            "",
            "# 用户生成提示词",
            userPrompt
        });
    }

    private async Task AppendRelatedChapterContextAsync(
        List<string> contextLines,
        Chapter chapter,
        CancellationToken ct)
    {
        var assist = await _editor.GetChapterAssistAsync(chapter.Id, MaxRecallItems, ct);
        var related = assist?.Related
            .Where(x => x.ProjectId == chapter.ProjectId)
            .Where(x => x.ChapterId != chapter.Id)
            .Where(x => x.ChapterNumber < chapter.ChapterNumber)
            .OrderByDescending(x => x.Score)
            .ThenByDescending(x => x.ChapterNumber)
            .Take(MaxRecallItems)
            .ToList();

        if (related == null || related.Count == 0) return;

        if (contextLines.Count == 0)
        {
            contextLines.Add("# 自动召回上下文（生成前置参考）");
        }

        var recallLines = new List<string>
        {
            "## 自动召回的相关章节上下文（仅用于连续性）",
            "以下内容用于保持人物、伏笔、设定、语气和前文因果一致。不要复述、不要照抄；如与章节规划冲突，优先遵守章节规划和用户生成提示词。"
        };

        var recallChars = recallLines.Sum(x => x.Length);
        foreach (var item in related)
        {
            var block = new[]
            {
                $"### 第{item.ChapterNumber}章：{FirstNonEmpty(item.Title, item.ChapterId)}",
                PromptLine("摘要", TruncatePromptField(item.Summary, MaxRecallFieldChars)),
                PromptLine("相关片段", TruncatePromptField(item.Snippet, MaxRecallFieldChars)),
                PromptLine("命中词", JoinList(item.MatchedKeywords.Take(8)))
            }.Where(x => !string.IsNullOrWhiteSpace(x)).ToList();

            var blockChars = block.Sum(x => x!.Length);
            if (recallChars + blockChars > MaxRecallContextChars) break;

            recallLines.AddRange(block!);
            recallChars += blockChars;
        }

        if (recallLines.Count > 2)
        {
            contextLines.AddRange(recallLines);
        }
    }

    private async Task<string> ResolveApiKeyAsync(ChapterDraftRequest request, CancellationToken ct)
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

        if (!string.IsNullOrWhiteSpace(request.ApiKey))
            return request.ApiKey;

        throw new InvalidOperationException("请选择已保存的 API Key，或填写临时 API Key。");
    }

    private async Task<string> AppendValidationRepairContextAsync(
        string basePrompt,
        string? validationReportId,
        string chapterId,
        CancellationToken ct)
    {
        ValidationReport? report = null;

        if (!string.IsNullOrWhiteSpace(validationReportId))
        {
            report = await _db.ValidationReports.AsNoTracking()
                .Include(x => x.Items)
                .FirstOrDefaultAsync(x => x.Id == validationReportId, ct);
        }
        else
        {
            report = await _db.ValidationReports.AsNoTracking()
                .Include(x => x.Items)
                .Where(x => x.ChapterId == chapterId)
                .OrderByDescending(x => x.ValidatedAt)
                .FirstOrDefaultAsync(ct);
        }

        if (report == null || !string.Equals(report.Result, "failed", StringComparison.OrdinalIgnoreCase))
        {
            return basePrompt;
        }

        var failedItems = report.Items
            .Where(static x => !string.Equals(x.Result, "passed", StringComparison.OrdinalIgnoreCase))
            .Take(12)
            .ToList();

        if (failedItems.Count == 0)
        {
            return basePrompt;
        }

        var repairLines = new List<string>
        {
            "# 校验修正上下文（本次必须优先修复）",
            $"校验摘要：{report.Summary}"
        };

        repairLines.AddRange(failedItems.Select((item, index) =>
            $"{index + 1}. [{item.ValidationType}] {item.Name}\n   问题：{item.Details}\n   建议：{item.Suggestion}"));

        repairLines.Add("请在保证章节规划、蓝图和上下文连续性的前提下，优先消除以上校验问题。");

        return string.Join("\n\n", new[]
        {
            string.Join("\n", repairLines),
            basePrompt
        });
    }

    private static string BuildRewritePrompt(string originalPrompt, string previousContent, IReadOnlyList<string> failures)
        => string.Join("\n", new[]
        {
            originalPrompt,
            "",
            "上一版生成未通过生成门禁，请只输出修正后的完整章节正文，并在末尾继续输出 ---CHANGES--- 与完整 JSON。",
            "必须修正以下门禁问题：",
            string.Join("\n", failures.Take(12).Select((x, i) => $"{i + 1}. {x}")),
            "",
            "上一版内容如下：",
            previousContent
        });

    private static IQueryable<T> FilterBySourceBook<T>(IQueryable<T> query, string? sourceBookId)
        where T : BusinessDataBase
        => string.IsNullOrWhiteSpace(sourceBookId)
            ? query
            : query.Where(x => x.SourceBookId == sourceBookId);

    private static string? PromptLine(string label, string? value)
        => string.IsNullOrWhiteSpace(value) ? null : $"- {label}: {value.Trim()}";

    private static string JoinList(IEnumerable<string> values)
        => string.Join("、", values.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).Distinct(StringComparer.OrdinalIgnoreCase));

    private static string FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim() ?? string.Empty;

    private static string? TruncatePromptField(string? value, int maxChars)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        var normalized = value.Trim();
        return normalized.Length <= maxChars
            ? normalized
            : normalized.Substring(0, maxChars) + "...";
    }

    private sealed class GenerationGateFailedException : InvalidOperationException
    {
        public GenerationGateFailedException(string message) : base(message) { }
    }

    private sealed record GenerationAttemptLog(
        int Attempt,
        string Stage,
        string RunId,
        string? Model,
        string? FinishReason,
        int ChunkCount,
        int CharCount,
        long ElapsedMs,
        bool Saved,
        GenerationGateResultDto Gate)
    {
        public static GenerationAttemptLog From(int attempt, AiTestResult result, GenerationGateResultDto gate)
            => new(
                attempt,
                gate.Success ? "generation_gate_passed" : "generation_gate",
                result.RunId,
                result.Model,
                result.FinishReason,
                result.ChunkCount,
                result.CharCount,
                result.ElapsedMs,
                false,
                gate);
    }
}
