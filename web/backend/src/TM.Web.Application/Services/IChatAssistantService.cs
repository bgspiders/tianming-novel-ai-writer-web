using TM.Web.Application.Dtos.Chat;

namespace TM.Web.Application.Services;

public interface IChatAssistantService
{
    Task<IReadOnlyList<ChatSessionDto>> ListSessionsAsync(string? projectId, CancellationToken ct = default);

    Task<ChatSessionDto> CreateSessionAsync(ChatSessionCreateRequest request, CancellationToken ct = default);

    Task<ChatSessionDto> UpdateSessionAsync(string id, ChatSessionUpdateRequest request, CancellationToken ct = default);

    Task DeleteSessionAsync(string id, CancellationToken ct = default);

    Task<IReadOnlyList<ChatMessageDto>> ListMessagesAsync(string sessionId, CancellationToken ct = default);

    Task<SendChatMessageResult> SendMessageAsync(string sessionId, SendChatMessageRequest request, CancellationToken ct = default);

    Task<ExecuteChatPlanResult> ExecutePlanAsync(string sessionId, string messageId, ExecuteChatPlanRequest request, CancellationToken ct = default);
}
