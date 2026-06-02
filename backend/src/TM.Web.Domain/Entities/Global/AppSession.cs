using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Global;

public class AppSession : EntityBase
{
    public string UserId { get; set; } = string.Empty;

    public string TokenHash { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }

    public DateTime? RevokedAt { get; set; }

    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;

    public AppUser? User { get; set; }
}

