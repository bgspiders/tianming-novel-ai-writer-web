using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Global;

/// <summary>
/// 通知历史。原 Storage/Framework/Notifications/NotificationManagement/。
/// 阶段 10 通知模块实施时使用。
/// </summary>
public class NotificationHistory : EntityBase
{
    /// <summary>类型：info / success / warning / error。</summary>
    public string Type { get; set; } = "info";

    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;

    /// <summary>点击通知后的跳转路由（前端）。</summary>
    public string? RouteLink { get; set; }

    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
}
