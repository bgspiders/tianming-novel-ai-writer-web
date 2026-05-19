using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Global;

/// <summary>
/// 主题。Payload 是 21 个 CSS variable + 元信息的 JSON。
/// 阶段 9 主题系统实施时灌入 17 套内置主题。
/// </summary>
public class Theme : EntityBase
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;

    /// <summary>主题数据 JSON（含 21 个 CSS variable）。</summary>
    public string Payload { get; set; } = "{}";

    public bool IsBuiltIn { get; set; }
    public bool IsFavorite { get; set; }
    public int SortOrder { get; set; }
}
