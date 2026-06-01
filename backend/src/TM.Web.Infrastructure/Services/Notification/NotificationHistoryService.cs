using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Notification;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Global;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Notification;

public sealed class NotificationHistoryService : INotificationHistoryService
{
    private static readonly HashSet<string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "info",
        "success",
        "warning",
        "error"
    };

    private readonly AppDbContext _db;

    public NotificationHistoryService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<NotificationItemDto>> ListAsync(
        int take = 50,
        bool? isRead = null,
        CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 200);

        var query = _db.NotificationHistory
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .AsQueryable();

        if (isRead.HasValue)
        {
            query = query.Where(x => x.IsRead == isRead.Value);
        }

        var rows = await query
            .Take(take)
            .ToListAsync(ct);

        return rows.Select(ToDto).ToList();
    }

    public async Task<NotificationItemDto> CreateAsync(
        NotificationCreateRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            throw new ArgumentException("Notification title is required.", nameof(request.Title));
        }

        var normalizedType = NormalizeType(request.Type);
        var entity = new NotificationHistory
        {
            Id = $"notif_{Guid.NewGuid():N}"[..30],
            Type = normalizedType,
            Title = request.Title.Trim(),
            Body = request.Body?.Trim() ?? string.Empty,
            RouteLink = string.IsNullOrWhiteSpace(request.RouteLink) ? null : request.RouteLink.Trim(),
            IsRead = false,
            ReadAt = null
        };

        _db.NotificationHistory.Add(entity);
        await _db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    public async Task<NotificationReadResult> MarkReadAsync(
        string id,
        NotificationReadRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new ArgumentException("Notification ID is required.", nameof(id));
        }

        var entity = await _db.NotificationHistory
            .FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new KeyNotFoundException($"Notification not found: {id}");

        entity.IsRead = request.IsRead;
        entity.ReadAt = request.IsRead ? DateTime.UtcNow : null;

        await _db.SaveChangesAsync(ct);
        return new NotificationReadResult(
            entity.Id,
            entity.IsRead,
            entity.ReadAt,
            entity.UpdatedAt);
    }

    private static string NormalizeType(string? value)
    {
        var normalized = string.IsNullOrWhiteSpace(value) ? "info" : value.Trim().ToLowerInvariant();
        if (!AllowedTypes.Contains(normalized))
        {
            throw new ArgumentException("Notification type must be info, success, warning, or error.", nameof(value));
        }

        return normalized;
    }

    private static NotificationItemDto ToDto(NotificationHistory entity)
        => new(
            entity.Id,
            entity.Type,
            entity.Title,
            entity.Body,
            entity.RouteLink,
            entity.IsRead,
            entity.ReadAt,
            entity.CreatedAt,
            entity.UpdatedAt);
}
