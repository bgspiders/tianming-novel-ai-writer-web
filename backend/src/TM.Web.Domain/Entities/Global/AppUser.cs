using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Global;

public class AppUser : EntityBase
{
    public string Username { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public string PasswordSalt { get; set; } = string.Empty;

    public DateTime? LastLoginAt { get; set; }
}

