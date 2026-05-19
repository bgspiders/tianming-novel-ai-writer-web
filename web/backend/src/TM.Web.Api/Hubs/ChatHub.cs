using Microsoft.AspNetCore.SignalR;

namespace TM.Web.Api.Hubs;

/// <summary>
/// 阶段 0 的最小聊天 / AI 流式推送 Hub。
/// 客户端 invoke("JoinRun", runId) 后即可订阅服务端通过 SendXxxAsync 推送的事件。
/// 后续阶段会扩展更多事件类型（生成进度、校验进度、Plan/Edit 模式信号等）。
/// </summary>
public sealed class ChatHub : Hub
{
    private readonly ILogger<ChatHub> _logger;

    public ChatHub(ILogger<ChatHub> logger)
    {
        _logger = logger;
    }

    public async Task JoinRun(string runId)
    {
        if (string.IsNullOrWhiteSpace(runId))
        {
            throw new HubException("runId 不能为空");
        }
        await Groups.AddToGroupAsync(Context.ConnectionId, runId);
        _logger.LogInformation("ConnectionId {Conn} joined run {RunId}", Context.ConnectionId, runId);
    }

    public async Task LeaveRun(string runId)
    {
        if (string.IsNullOrWhiteSpace(runId))
        {
            return;
        }
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, runId);
        _logger.LogInformation("ConnectionId {Conn} left run {RunId}", Context.ConnectionId, runId);
    }

    public override Task OnConnectedAsync()
    {
        _logger.LogDebug("Client connected: {ConnectionId}", Context.ConnectionId);
        return base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogDebug("Client disconnected: {ConnectionId}", Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }
}
