namespace TM.Web.Application.Services;

/// <summary>
/// 流式生成进度推送抽象。
/// 由 Api 层用 SignalR 实现，Application/LegacyBridge 通过此接口对外发出 token/事件，
/// 避免业务层直接依赖具体推送基础设施（替代原 WPF 项目里的静态 GenerationProgressHub）。
/// </summary>
public interface IGenerationNotifier
{
    Task TokenAsync(string runId, string token, CancellationToken ct = default);

    Task StatusAsync(string runId, string status, CancellationToken ct = default);

    Task CompletedAsync(string runId, string? finishReason, CancellationToken ct = default);

    Task ErrorAsync(string runId, string message, CancellationToken ct = default);
}
