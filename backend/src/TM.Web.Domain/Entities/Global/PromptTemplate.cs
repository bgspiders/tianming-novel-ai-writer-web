using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Global;

/// <summary>
/// 提示词模板。对应原 Storage/Modules/AIAssistant/PromptTools/PromptManagement/。
/// </summary>
public class PromptTemplate : EntityBase
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;
    public string? Description { get; set; }

    /// <summary>模板变量定义 JSON：[{ "name": "topic", "type": "string", "required": true }]</summary>
    public string Variables { get; set; } = "[]";

    public bool IsBuiltIn { get; set; }
    public bool IsFavorite { get; set; }
    public bool IsEnabled { get; set; } = true;
    public int SortOrder { get; set; }
}
