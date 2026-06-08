using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using TM.Web.Application.Dtos;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Runtime;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Generation;

public sealed class SceneGenerationService : ISceneGenerationService
{
    private readonly AppDbContext _db;
    private readonly IAiCompletionService _ai;
    private readonly IAiApiKeyService _apiKeys;
    private readonly IContextPackagingService _contexts;
    private readonly ILogger<SceneGenerationService> _logger;
    private readonly string _storageRoot;

    public SceneGenerationService(
        AppDbContext db,
        IAiCompletionService ai,
        IAiApiKeyService apiKeys,
        IContextPackagingService contexts,
        IConfiguration configuration,
        ILogger<SceneGenerationService> logger)
    {
        _db = db;
        _ai = ai;
        _apiKeys = apiKeys;
        _contexts = contexts;
        _logger = logger;
        _storageRoot = DbServiceCollectionExtensions.ResolveStorageRoot(configuration);
    }

    public async Task<SceneDraftResult> GenerateSceneDraftAsync(SceneDraftRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.ProjectId)) throw new InvalidOperationException("项目 ID 不能为空。");
        if (string.IsNullOrWhiteSpace(request.ChapterId)) throw new InvalidOperationException("章节 ID 不能为空。");
        if (request.SceneNumber <= 0) throw new InvalidOperationException("场景序号必须大于 0。");

        var chapter = await _db.Chapters.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.ChapterId && x.ProjectId == request.ProjectId, ct)
            ?? throw new InvalidOperationException("章节不存在或不属于当前项目。");
        var blueprint = await _db.ChapterBlueprints.AsNoTracking()
            .Where(x => x.ChapterId == request.ChapterId && x.SceneNumber == request.SceneNumber)
            .OrderBy(x => x.UpdatedAt)
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException($"第 {request.SceneNumber} 个场景蓝图不存在。");

        var context = await _contexts.BuildGenerationContextAsync(new GenerationContextRequest
        {
            ProjectId = request.ProjectId,
            ChapterId = request.ChapterId,
            SceneNumber = request.SceneNumber
        }, ct);
        var prompt = BuildScenePrompt(
            context.ContextText,
            chapter.ChapterNumber,
            chapter.Title,
            blueprint.SceneNumber,
            blueprint.SceneTitle,
            request.Prompt,
            blueprint);
        var record = new SceneGenerationRecord
        {
            RunId = string.IsNullOrWhiteSpace(request.RunId) ? Guid.NewGuid().ToString("N") : request.RunId,
            ProjectId = request.ProjectId,
            ChapterId = request.ChapterId,
            SceneNumber = request.SceneNumber,
            SceneTitle = blueprint.SceneTitle,
            Model = request.Model,
            PromptSnapshot = prompt,
            Success = false
        };
        _db.SceneGenerationRecords.Add(record);
        await _db.SaveChangesAsync(ct);

        try
        {
            var apiKey = await ResolveApiKeyAsync(request, ct);
            var result = await _ai.CompleteAsync(new AiTestRequest
            {
                RunId = record.RunId,
                Endpoint = request.Endpoint,
                ApiKey = apiKey,
                Model = request.Model,
                SystemPrompt = request.SystemPrompt ?? "你是一名专业网络小说作者。只输出当前场景正文，不输出解释。",
                Prompt = prompt,
                Temperature = request.Temperature,
                MaxTokens = request.MaxTokens
            }, ct);

            record.Content = result.Content ?? string.Empty;
            record.Success = true;
            record.CharCount = record.Content.Length;
            record.ElapsedMs = result.ElapsedMs;
            record.FinishReason = result.FinishReason;
            await _db.SaveChangesAsync(ct);
            AddPromptSnapshot(
                record.RunId,
                request,
                context,
                prompt,
                record.Content,
                success: true,
                error: string.Empty,
                result.ElapsedMs);
            await _db.SaveChangesAsync(ct);

            return ToResult(record);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Scene generation failed. ChapterId={ChapterId} SceneNumber={SceneNumber}", request.ChapterId, request.SceneNumber);
            record.Success = false;
            record.Error = ex.Message;
            AddPromptSnapshot(
                record.RunId,
                request,
                context,
                prompt,
                output: string.Empty,
                success: false,
                error: ex.Message,
                elapsedMs: 0);
            await _db.SaveChangesAsync(ct);
            return ToResult(record);
        }
    }

    public async Task<SceneComposeResult> ComposeChapterAsync(SceneComposeRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.ProjectId)) throw new InvalidOperationException("项目 ID 不能为空。");
        if (string.IsNullOrWhiteSpace(request.ChapterId)) throw new InvalidOperationException("章节 ID 不能为空。");

        var chapter = await _db.Chapters.FirstOrDefaultAsync(x => x.Id == request.ChapterId && x.ProjectId == request.ProjectId, ct)
            ?? throw new InvalidOperationException("章节不存在或不属于当前项目。");

        var latestRecords = await _db.SceneGenerationRecords.AsNoTracking()
            .Where(x => x.ProjectId == request.ProjectId && x.ChapterId == request.ChapterId && x.Success)
            .GroupBy(x => x.SceneNumber)
            .Select(g => g.OrderByDescending(x => x.CreatedAt).First())
            .ToListAsync(ct);

        var ordered = latestRecords.OrderBy(x => x.SceneNumber).ToList();
        if (ordered.Count == 0) throw new InvalidOperationException("没有可合成的成功场景正文。");

        var content = string.Join("\n\n", ordered.Select(x => x.Content.Trim()).Where(x => !string.IsNullOrWhiteSpace(x)));
        var wordCount = CountWords(content);
        var saved = false;
        if (request.SaveToChapter)
        {
            if (string.IsNullOrWhiteSpace(chapter.ContentFilePath))
            {
                chapter.ContentFilePath = Path.Combine("projects", chapter.ProjectId, "chapters", $"{chapter.Id}.md").Replace('\\', '/');
            }

            var fullPath = Path.Combine(_storageRoot, chapter.ContentFilePath.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
            await File.WriteAllTextAsync(fullPath, content, ct);
            chapter.WordCount = wordCount;
            chapter.Status = "drafted";
            await _db.SaveChangesAsync(ct);
            saved = true;
        }

        return new SceneComposeResult
        {
            ProjectId = request.ProjectId,
            ChapterId = request.ChapterId,
            SceneCount = ordered.Count,
            WordCount = wordCount,
            Content = content,
            SavedToChapter = saved
        };
    }

    private async Task<string> ResolveApiKeyAsync(SceneDraftRequest request, CancellationToken ct)
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
        throw new InvalidOperationException("API Key 不能为空。");
    }

    private static string BuildScenePrompt(
        string contextText,
        int chapterNumber,
        string chapterTitle,
        int sceneNumber,
        string sceneTitle,
        string userPrompt,
        TM.Web.Domain.Entities.Generate.ChapterBlueprint blueprint)
        => string.Join('\n', new[]
        {
            "# 自动装配生成上下文（P0/P1/P2/P3）",
            contextText,
            "",
            $"章节：第 {chapterNumber} 章《{chapterTitle}》",
            $"场景：{sceneNumber}. {FirstNonEmpty(sceneTitle, blueprint.Name)}",
            "",
            "# 场景蓝图",
            Line("一句话结构", blueprint.OneLineStructure),
            Line("节奏曲线", blueprint.PacingCurve),
            Line("开场", blueprint.Opening),
            Line("发展", blueprint.Development),
            Line("转折", blueprint.Turning),
            Line("收束", blueprint.Ending),
            Line("信息增量", blueprint.InfoDrop),
            Line("出场角色", blueprint.Cast),
            Line("地点", blueprint.Locations),
            Line("势力", blueprint.Factions),
            Line("道具/线索", blueprint.ItemsClues),
            "",
            "# 用户要求",
            string.IsNullOrWhiteSpace(userPrompt) ? "按场景蓝图生成当前场景正文。" : userPrompt.Trim()
        }.Where(x => x.Length > 0));

    private static string Line(string label, string value)
        => string.IsNullOrWhiteSpace(value) ? string.Empty : $"- {label}：{value.Trim()}";

    private static string FirstNonEmpty(params string[] values)
        => values.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim() ?? string.Empty;

    private static int CountWords(string? content)
        => string.IsNullOrWhiteSpace(content) ? 0 : content.Count(c => !char.IsWhiteSpace(c));

    private void AddPromptSnapshot(
        string runId,
        SceneDraftRequest request,
        GenerationContextResult context,
        string prompt,
        string output,
        bool success,
        string error,
        long elapsedMs)
    {
        _db.PromptRunSnapshots.Add(new PromptRunSnapshot
        {
            RunId = runId,
            ProjectId = request.ProjectId,
            ChapterId = request.ChapterId,
            Source = "scene_draft",
            Model = request.Model,
            Temperature = request.Temperature,
            MaxTokens = request.MaxTokens,
            ContextHash = Sha256(context.ContextText),
            ContextSummary = Truncate(context.ContextText, 1600),
            PromptSummary = Truncate(prompt, 1600),
            OutputSummary = Truncate(output, 800),
            Success = success,
            Error = error,
            ElapsedMs = elapsedMs
        });
    }

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

    private static SceneDraftResult ToResult(SceneGenerationRecord record)
        => new()
        {
            RecordId = record.Id,
            RunId = record.RunId,
            ProjectId = record.ProjectId,
            ChapterId = record.ChapterId,
            SceneNumber = record.SceneNumber,
            SceneTitle = record.SceneTitle,
            Content = record.Content,
            CharCount = record.CharCount,
            FinishReason = record.FinishReason,
            ElapsedMs = record.ElapsedMs,
            Success = record.Success,
            Error = string.IsNullOrWhiteSpace(record.Error) ? null : record.Error
        };
}
