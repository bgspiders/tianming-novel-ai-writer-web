using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Global;

/// <summary>
/// 应用级 KV 设置表（Key 唯一）。原项目散落在 Storage/Services/Settings 下若干 JSON。
/// 例如：theme.current、auto-theme.cron、notification.dnd-window 等。
/// </summary>
public class AppSetting : EntityBase
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string? ValueType { get; set; }
}
