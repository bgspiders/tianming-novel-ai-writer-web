namespace TM.Web.Application.Dtos.Chat;

using TM.Web.Application.Services.Chat.Parsing;

public sealed record ChatSessionDto(
    string Id,
    string? ProjectId,
    string Title,
    string Mode,
    string? ModelCode,
    string? ProviderId,
    DateTime LastMessageAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record ChatMessageDto(
    string Id,
    string ChatSessionId,
    string Role,
    string Content,
    string? Summary,
    string? ThinkingContent,
    string? AnalysisBlocksJson,
    string? ToolPayload,
    int? InputTokens,
    int? OutputTokens,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record ChatSessionCreateRequest(
    string? ProjectId,
    string Mode = "agent",
    string? Title = null,
    string? ProviderId = null,
    string? ModelCode = null);

public sealed record ChatSessionUpdateRequest(
    string? Title = null,
    string? Mode = null,
    string? ProviderId = null,
    string? ModelCode = null);

public sealed record SendChatMessageRequest(
    string RunId,
    string Content,
    string Endpoint,
    string Model,
    string? ProviderId = null,
    string? ApiKeyId = null,
    string? ApiKey = null,
    decimal? Temperature = null,
    int? MaxTokens = null);

public sealed record SendChatMessageResult(
    string RunId,
    string SessionId,
    string UserMessageId,
    string AssistantMessageId,
    string FinishReason,
    int ChunkCount,
    int CharCount,
    long ElapsedMs);

public sealed record ExecuteChatPlanRequest(
    string RunId);

public sealed record ExecuteChatPlanResult(
    string RunId,
    string SessionId,
    string MessageId,
    string FinishReason,
    int TraceCount,
    ExecutionTraceSummaryPayload? ExecutionTraceSummary,
    ChatMessageDto Message);

public sealed record ChatRunEventDto(
    string Type,
    string Message,
    DateTime At,
    object? Data = null);
