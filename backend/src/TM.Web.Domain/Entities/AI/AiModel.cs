using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.AI;

/// <summary>
/// AI 模型。Capabilities 用 JSON 列存储能力清单（vision / tools / streaming / thinking / json_mode）。
/// </summary>
public class AiModel : EntityBase
{
    public string ProviderId { get; set; } = string.Empty;

    /// <summary>模型代码，如 "gpt-4o-mini" / "claude-3-5-sonnet-20241022"。</summary>
    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    public int? ContextWindow { get; set; }
    public int? MaxOutputTokens { get; set; }

    /// <summary>能力 JSON：{ "vision": true, "tools": true, "thinking": false }</summary>
    public string Capabilities { get; set; } = "{}";

    public decimal? InputPricePerMillion { get; set; }
    public decimal? OutputPricePerMillion { get; set; }

    public bool IsEnabled { get; set; } = true;
    public int SortOrder { get; set; }

    public AiProvider? Provider { get; set; }
}
