using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Chat;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/chat-assistant")]
public sealed class ChatAssistantController : ControllerBase
{
    private readonly IChatAssistantService _chat;

    public ChatAssistantController(IChatAssistantService chat)
    {
        _chat = chat;
    }

    [HttpGet("sessions")]
    public Task<IReadOnlyList<ChatSessionDto>> ListSessions([FromQuery] string? projectId, CancellationToken ct)
        => _chat.ListSessionsAsync(projectId, ct);

    [HttpPost("sessions")]
    public Task<ChatSessionDto> CreateSession([FromBody] ChatSessionCreateRequest request, CancellationToken ct)
        => _chat.CreateSessionAsync(request, ct);

    [HttpPut("sessions/{id}")]
    public Task<ChatSessionDto> UpdateSession(string id, [FromBody] ChatSessionUpdateRequest request, CancellationToken ct)
        => _chat.UpdateSessionAsync(id, request, ct);

    [HttpDelete("sessions/{id}")]
    public async Task<IActionResult> DeleteSession(string id, CancellationToken ct)
    {
        await _chat.DeleteSessionAsync(id, ct);
        return NoContent();
    }

    [HttpGet("sessions/{id}/messages")]
    public Task<IReadOnlyList<ChatMessageDto>> ListMessages(string id, CancellationToken ct)
        => _chat.ListMessagesAsync(id, ct);

    [HttpPost("sessions/{id}/messages")]
    public Task<SendChatMessageResult> SendMessage(string id, [FromBody] SendChatMessageRequest request, CancellationToken ct)
        => _chat.SendMessageAsync(id, request, ct);

    [HttpPost("sessions/{id}/messages/{messageId}/execute")]
    public Task<ExecuteChatPlanResult> ExecutePlan(string id, string messageId, [FromBody] ExecuteChatPlanRequest request, CancellationToken ct)
        => _chat.ExecutePlanAsync(id, messageId, request, ct);
}
