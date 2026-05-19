using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Runtime;

/// <summary>
/// AI 助手聊天会话。Mode = agent / plan / edit。
/// </summary>
public class ChatSession : EntityBase
{
    public string? ProjectId { get; set; }

    public string Title { get; set; } = string.Empty;
    public string Mode { get; set; } = "agent";

    /// <summary>使用的模型代码。</summary>
    public string? ModelCode { get; set; }
    public string? ProviderId { get; set; }

    public DateTime LastMessageAt { get; set; } = DateTime.UtcNow;

    public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
}

/// <summary>
/// 聊天消息。Role = system / user / assistant / tool。
/// ThinkingContent 是 Anthropic / DeepSeek 等支持的思考链。
/// </summary>
public class ChatMessage : EntityBase
{
    public string ChatSessionId { get; set; } = string.Empty;

    public string Role { get; set; } = "user";
    public string Content { get; set; } = string.Empty;
    public string? ThinkingContent { get; set; }

    /// <summary>tool_calls / tool_results 的 JSON 序列化（如有）。</summary>
    public string? ToolPayload { get; set; }

    public int? InputTokens { get; set; }
    public int? OutputTokens { get; set; }

    public ChatSession? ChatSession { get; set; }
}
