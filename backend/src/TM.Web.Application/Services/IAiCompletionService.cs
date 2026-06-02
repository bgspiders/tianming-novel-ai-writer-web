using TM.Web.Application.Dtos;

namespace TM.Web.Application.Services;

public interface IAiCompletionService
{
    /// <summary>
    /// 用 OpenAI 兼容接口调用一次 Chat Completion，结果通过 <see cref="IGenerationNotifier"/> 流式推到指定 runId。
    /// HTTP 调用方仅拿到元数据（不阻塞 HTTP 长连接）。
    /// </summary>
    Task<AiTestResult> StreamAsync(AiTestRequest request, CancellationToken ct = default);

    /// <summary>
    /// 非流式调用，用于需要完整结构化结果后再解析入库的后台编排。
    /// </summary>
    Task<AiTestResult> CompleteAsync(AiTestRequest request, CancellationToken ct = default);
}
