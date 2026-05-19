using Microsoft.AspNetCore.SignalR;
using TM.Web.Api.Hubs;
using TM.Web.Application.Services;

namespace TM.Web.Api.Notifications;

/// <summary>
/// SignalR 实现的 <see cref="IGenerationNotifier"/>。
/// 通过 IHubContext 把事件按 runId 推到对应分组。
/// 客户端事件名约定：ReceiveToken / Status / Completed / Error。
/// </summary>
public sealed class SignalRGenerationNotifier : IGenerationNotifier
{
    private readonly IHubContext<ChatHub> _hub;

    public SignalRGenerationNotifier(IHubContext<ChatHub> hub)
    {
        _hub = hub;
    }

    public Task TokenAsync(string runId, string token, CancellationToken ct = default)
        => _hub.Clients.Group(runId).SendAsync("ReceiveToken", token, ct);

    public Task StatusAsync(string runId, string status, CancellationToken ct = default)
        => _hub.Clients.Group(runId).SendAsync("Status", status, ct);

    public Task CompletedAsync(string runId, string? finishReason, CancellationToken ct = default)
        => _hub.Clients.Group(runId).SendAsync("Completed", finishReason ?? "stop", ct);

    public Task ErrorAsync(string runId, string message, CancellationToken ct = default)
        => _hub.Clients.Group(runId).SendAsync("Error", message, ct);
}
