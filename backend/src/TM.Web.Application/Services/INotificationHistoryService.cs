using TM.Web.Application.Dtos.Notification;

namespace TM.Web.Application.Services;

public interface INotificationHistoryService
{
    Task<IReadOnlyList<NotificationItemDto>> ListAsync(int take = 50, bool? isRead = null, CancellationToken ct = default);

    Task<NotificationItemDto> CreateAsync(NotificationCreateRequest request, CancellationToken ct = default);

    Task<NotificationReadResult> MarkReadAsync(string id, NotificationReadRequest request, CancellationToken ct = default);
}
