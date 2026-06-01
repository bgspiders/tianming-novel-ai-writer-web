using System.Diagnostics;
using System.Net.Http;
using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using TM.Web.Application.Dtos;

namespace TM.Web.Application.Services;

public sealed class AiCompletionService : IAiCompletionService
{
    private readonly IGenerationNotifier _notifier;
    private readonly IAiHttpClientFactory _httpClientFactory;
    private readonly ILogger<AiCompletionService> _logger;

    public AiCompletionService(
        IGenerationNotifier notifier,
        IAiHttpClientFactory httpClientFactory,
        ILogger<AiCompletionService> logger)
    {
        _notifier = notifier;
        _httpClientFactory = httpClientFactory;
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
                    apiKey: request.ApiKey,
                    httpClient: _httpClientFactory.CreateOpenAiCompatibleClient())
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
            var content = new StringBuilder();

            await _notifier.StatusAsync(request.RunId, "streaming", ct);

            string? finishReason = null;
            await foreach (var chunk in chat.GetStreamingChatMessageContentsAsync(history, settings, kernel, ct))
            {
                if (!string.IsNullOrEmpty(chunk.Content))
                {
                    content.Append(chunk.Content);
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
            result.Content = content.ToString();
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
            var message = BuildAiFailureMessage(ex, result.CharCount, request.MaxTokens);
            await _notifier.ErrorAsync(request.RunId, message, CancellationToken.None);
            throw new InvalidOperationException(message, ex);
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

    private static string BuildAiFailureMessage(Exception ex, int streamedChars, int? maxTokens)
    {
        var root = GetInnermostMessage(ex);
        var tokenHint = maxTokens.HasValue ? $"当前最大 Tokens={maxTokens.Value}。" : string.Empty;

        if (ex is HttpRequestException || root.Contains("sending the request", StringComparison.OrdinalIgnoreCase))
        {
            return streamedChars > 0
                ? $"AI 上游连接在已返回 {streamedChars} 个字符后中断。{tokenHint}请降低最大 Tokens，或换用支持更长输出/更稳定流式响应的模型后重试。原始错误：{root}"
                : $"AI 上游请求发送失败。请检查 Endpoint、API Key、代理/网络，以及模型是否支持当前最大 Tokens。{tokenHint}原始错误：{root}";
        }

        if (root.Contains("timeout", StringComparison.OrdinalIgnoreCase)
            || root.Contains("timed out", StringComparison.OrdinalIgnoreCase))
        {
            return streamedChars > 0
                ? $"AI 上游长文本生成超时，已返回 {streamedChars} 个字符。{tokenHint}请降低最大 Tokens 或分段生成。"
                : $"AI 上游请求超时。{tokenHint}请降低最大 Tokens、检查网络，或稍后重试。";
        }

        return root;
    }

    private static string GetInnermostMessage(Exception ex)
    {
        var current = ex;
        while (current.InnerException is not null)
        {
            current = current.InnerException;
        }

        return current.Message;
    }
}
