using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Notification;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/notifications")]
public sealed class NotificationsController : ControllerBase
{
    private readonly INotificationHistoryService _notifications;

    public NotificationsController(INotificationHistoryService notifications)
    {
        _notifications = notifications;
    }

    [HttpGet]
    public Task<IReadOnlyList<NotificationItemDto>> List(
        [FromQuery] int take = 50,
        [FromQuery] bool? isRead = null,
        CancellationToken ct = default)
        => _notifications.ListAsync(take, isRead, ct);

    [HttpPost]
    public Task<NotificationItemDto> Create(
        [FromBody] NotificationCreateRequest request,
        CancellationToken ct = default)
        => _notifications.CreateAsync(request, ct);

    [HttpPut("{id}/read")]
    public Task<NotificationReadResult> MarkRead(
        string id,
        [FromBody] NotificationReadRequest request,
        CancellationToken ct = default)
        => _notifications.MarkReadAsync(id, request, ct);
}
