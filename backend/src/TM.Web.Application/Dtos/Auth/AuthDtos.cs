namespace TM.Web.Application.Dtos.Auth;

public sealed class AuthStatusDto
{
    public bool IsInitialized { get; set; }

    public bool IsAuthenticated { get; set; }

    public string? Username { get; set; }

    public DateTime? ExpiresAt { get; set; }
}

public sealed class SetupAdminRequest
{
    public string Username { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;
}

public sealed class LoginRequest
{
    public string Username { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;
}

public sealed class AuthResultDto
{
    public string Username { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }
}

