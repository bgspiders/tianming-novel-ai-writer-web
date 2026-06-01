using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.AI;

/// <summary>
/// AI 提供商配置。如 OpenAI / Anthropic / Gemini / DeepSeek / Moonshot 等。
/// </summary>
public class AiProvider : EntityBase
{
    /// <summary>稳定唯一编码，如 "openai" / "anthropic" / "gemini"。</summary>
    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public string? DefaultEndpoint { get; set; }
    public string? IconUrl { get; set; }
    public string? Notes { get; set; }

    /// <summary>是否为内置（不允许删除）。</summary>
    public bool IsBuiltIn { get; set; }

    public bool IsEnabled { get; set; } = true;

    public int SortOrder { get; set; }

    public ICollection<AiModel> Models { get; set; } = new List<AiModel>();
    public ICollection<AiApiKey> ApiKeys { get; set; } = new List<AiApiKey>();
}
