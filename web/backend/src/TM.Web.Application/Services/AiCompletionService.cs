using System.Diagnostics;
using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using TM.Web.Application.Dtos;

namespace TM.Web.Application.Services;

public sealed class AiCompletionService : IAiCompletionService
{
    private readonly IGenerationNotifier _notifier;
    private readonly ILogger<AiCompletionService> _logger;

    public AiCompletionService(IGenerationNotifier notifier, ILogger<AiCompletionService> logger)
    {
        _notifier = notifier;
        _logger = logger;
    }

    public async Task<AiTestResult> StreamAsync(AiTestRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.RunId))
        {
            throw new ArgumentException("RunId 不能为空", nameof(request));
        }
        if (string.IsNullOrWhiteSpace(request.Endpoint))
        {
            throw new ArgumentException("Endpoint 不能为空（例如 https://api.openai.com/v1）", nameof(request));
        }
        if (string.IsNullOrWhiteSpace(request.ApiKey))
        {
            throw new ArgumentException("ApiKey 不能为空", nameof(request));
        }
        if (string.IsNullOrWhiteSpace(request.Model))
        {
            throw new ArgumentException("Model 不能为空", nameof(request));
        }
        if (string.IsNullOrWhiteSpace(request.Prompt))
        {
            throw new ArgumentException("Prompt 不能为空", nameof(request));
        }

        var sw = Stopwatch.StartNew();
        var result = new AiTestResult
        {
            RunId = request.RunId,
            Model = request.Model
        };

        try
        {
            await _notifier.StatusAsync(request.RunId, "connecting", ct);

            var kernel = Kernel.CreateBuilder()
                .AddOpenAIChatCompletion(
                    modelId: request.Model,
                    endpoint: new Uri(NormalizeEndpoint(request.Endpoint)),
                    apiKey: request.ApiKey)
                .Build();

            var chat = kernel.GetRequiredService<IChatCompletionService>();

            var history = new ChatHistory();
            if (!string.IsNullOrWhiteSpace(request.SystemPrompt))
            {
                history.AddSystemMessage(request.SystemPrompt!);
            }
            history.AddUserMessage(request.Prompt);

            var settings = new OpenAIPromptExecutionSettings
            {
                Temperature = request.Temperature ?? 0.7,
                MaxTokens = request.MaxTokens ?? 1024
            };

            await _notifier.StatusAsync(request.RunId, "streaming", ct);

            string? finishReason = null;
            await foreach (var chunk in chat.GetStreamingChatMessageContentsAsync(history, settings, kernel, ct))
            {
                if (!string.IsNullOrEmpty(chunk.Content))
                {
                    result.ChunkCount++;
                    result.CharCount += chunk.Content.Length;
                    await _notifier.TokenAsync(request.RunId, chunk.Content, ct);
                }

                if (chunk.Metadata is not null
                    && chunk.Metadata.TryGetValue("FinishReason", out var raw)
                    && raw is not null)
                {
                    finishReason = raw.ToString();
                }
            }

            result.FinishReason = finishReason ?? "stop";
            await _notifier.CompletedAsync(request.RunId, result.FinishReason, ct);

            _logger.LogInformation(
                "AI completion done. runId={RunId} chunks={Chunks} chars={Chars} reason={Reason}",
                request.RunId, result.ChunkCount, result.CharCount, result.FinishReason);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            _logger.LogInformation("AI completion cancelled. runId={RunId}", request.RunId);
            await _notifier.StatusAsync(request.RunId, "cancelled", CancellationToken.None);
            result.FinishReason = "cancelled";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI completion failed. runId={RunId}", request.RunId);
            await _notifier.ErrorAsync(request.RunId, ex.Message, CancellationToken.None);
            throw;
        }
        finally
        {
            sw.Stop();
            result.ElapsedMs = sw.ElapsedMilliseconds;
        }

        return result;
    }

    /// <summary>
    /// OpenAI 兼容服务的常见坑：端点必须带 /v1 才能正确路由。
    /// 如果用户填了根域名（如 https://api.deepseek.com），自动补齐。
    /// 已经带 /v1、/openai/v1 等的不动。
    /// </summary>
    private static string NormalizeEndpoint(string endpoint)
    {
        var trimmed = endpoint.Trim().TrimEnd('/');
        var lower = trimmed.ToLowerInvariant();
        if (lower.EndsWith("/v1") || lower.Contains("/v1/") || lower.EndsWith("/openai"))
        {
            return trimmed;
        }
        return trimmed + "/v1";
    }
}
