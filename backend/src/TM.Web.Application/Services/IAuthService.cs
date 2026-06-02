using TM.Web.Application.Dtos.Auth;

namespace TM.Web.Application.Services;

public interface IAuthService
{
    Task<AuthStatusDto> GetStatusAsync(string? sessionToken, CancellationToken ct = default);

    Task<AuthSessionIssue> SetupAsync(SetupAdminRequest request, CancellationToken ct = default);

    Task<AuthSessionIssue> LoginAsync(LoginRequest request, CancellationToken ct = default);

    Task LogoutAsync(string? sessionToken, CancellationToken ct = default);
}

public sealed record AuthSessionIssue(AuthResultDto Result, string SessionToken);
