namespace TM.Web.Application.Dtos.Notification;

public sealed record NotificationItemDto(
    string Id,
    string Type,
    string Title,
    string Body,
    string? RouteLink,
    bool IsRead,
    DateTime? ReadAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record NotificationCreateRequest(
    string Type,
    string Title,
    string Body,
    string? RouteLink);

public sealed record NotificationReadRequest(
    bool IsRead);

public sealed record NotificationReadResult(
    string Id,
    bool IsRead,
    DateTime? ReadAt,
    DateTime UpdatedAt);
