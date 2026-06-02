using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Auth;
using TM.Web.Application.Services;
using TM.Web.Infrastructure.Services.Auth;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;

    public AuthController(IAuthService auth)
    {
        _auth = auth;
    }

    [HttpGet("status")]
    public Task<AuthStatusDto> Status(CancellationToken ct)
        => _auth.GetStatusAsync(ReadSessionToken(), ct);

    [HttpPost("setup")]
    public async Task<AuthResultDto> Setup([FromBody] SetupAdminRequest request, CancellationToken ct)
    {
        var issue = await _auth.SetupAsync(request, ct);
        WriteSessionCookie(issue);
        return issue.Result;
    }

    [HttpPost("login")]
    public async Task<AuthResultDto> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var issue = await _auth.LoginAsync(request, ct);
        WriteSessionCookie(issue);
        return issue.Result;
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        await _auth.LogoutAsync(ReadSessionToken(), ct);
        Response.Cookies.Delete(AuthService.CookieName);
        return NoContent();
    }

    private string? ReadSessionToken()
        => Request.Cookies.TryGetValue(AuthService.CookieName, out var token) ? token : null;

    private void WriteSessionCookie(AuthSessionIssue issue)
    {
        Response.Cookies.Append(AuthService.CookieName, issue.SessionToken, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            Secure = Request.IsHttps,
            Expires = issue.Result.ExpiresAt,
            Path = "/"
        });
    }
}

