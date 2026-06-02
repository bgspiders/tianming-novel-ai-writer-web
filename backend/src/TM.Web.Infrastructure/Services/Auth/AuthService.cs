using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Auth;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Global;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Auth;

public sealed class AuthService : IAuthService
{
    public const string CookieName = "tm_web_session";
    public static readonly TimeSpan SessionLifetime = TimeSpan.FromDays(30);

    private const int SaltBytes = 16;
    private const int HashBytes = 32;
    private const int PasswordIterations = 210_000;

    private readonly AppDbContext _db;

    public AuthService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<AuthStatusDto> GetStatusAsync(string? sessionToken, CancellationToken ct = default)
    {
        var isInitialized = await _db.AppUsers.AsNoTracking().AnyAsync(ct);
        var session = await FindValidSessionAsync(sessionToken, tracking: true, ct);
        if (session is not null)
        {
            session.LastSeenAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }

        return new AuthStatusDto
        {
            IsInitialized = isInitialized,
            IsAuthenticated = session is not null,
            Username = session?.User?.Username,
            ExpiresAt = session?.ExpiresAt
        };
    }

    public async Task<AuthSessionIssue> SetupAsync(SetupAdminRequest request, CancellationToken ct = default)
    {
        if (await _db.AppUsers.AnyAsync(ct))
        {
            throw new InvalidOperationException("管理员账号已初始化。");
        }

        var username = NormalizeUsername(request.Username);
        ValidatePassword(request.Password);
        var (salt, hash) = HashPassword(request.Password);

        var user = new AppUser
        {
            Username = username,
            PasswordSalt = salt,
            PasswordHash = hash,
            LastLoginAt = DateTime.UtcNow
        };
        _db.AppUsers.Add(user);
        await _db.SaveChangesAsync(ct);

        return await IssueSessionAsync(user, ct);
    }

    public async Task<AuthSessionIssue> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var username = NormalizeUsername(request.Username);
        var user = await _db.AppUsers.FirstOrDefaultAsync(x => x.Username == username, ct)
                   ?? throw new InvalidOperationException("账号或密码错误。");

        if (!VerifyPassword(request.Password, user.PasswordSalt, user.PasswordHash))
        {
            throw new InvalidOperationException("账号或密码错误。");
        }

        user.LastLoginAt = DateTime.UtcNow;
        return await IssueSessionAsync(user, ct);
    }

    public async Task LogoutAsync(string? sessionToken, CancellationToken ct = default)
    {
        var session = await FindValidSessionAsync(sessionToken, tracking: true, ct);
        if (session is null) return;

        session.RevokedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    private async Task<AuthSessionIssue> IssueSessionAsync(AppUser user, CancellationToken ct)
    {
        var token = CreateToken();
        var expiresAt = DateTime.UtcNow.Add(SessionLifetime);
        _db.AppSessions.Add(new AppSession
        {
            UserId = user.Id,
            TokenHash = HashToken(token),
            ExpiresAt = expiresAt,
            LastSeenAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);

        return new AuthSessionIssue(
            new AuthResultDto
            {
                Username = user.Username,
                ExpiresAt = expiresAt
            },
            token);
    }

    private async Task<AppSession?> FindValidSessionAsync(string? sessionToken, bool tracking, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(sessionToken)) return null;

        var now = DateTime.UtcNow;
        var tokenHash = HashToken(sessionToken);
        var query = _db.AppSessions.Include(x => x.User).Where(x =>
            x.TokenHash == tokenHash &&
            x.RevokedAt == null &&
            x.ExpiresAt > now);
        if (!tracking)
        {
            query = query.AsNoTracking();
        }

        return await query.FirstOrDefaultAsync(ct);
    }

    private static string NormalizeUsername(string? username)
    {
        var normalized = username?.Trim() ?? string.Empty;
        if (normalized.Length < 3 || normalized.Length > 64)
        {
            throw new InvalidOperationException("账号长度必须为 3-64 个字符。");
        }

        return normalized;
    }

    private static void ValidatePassword(string? password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < 6 || password.Length > 128)
        {
            throw new InvalidOperationException("密码长度必须为 6-128 个字符。");
        }
    }

    private static (string Salt, string Hash) HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltBytes);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, PasswordIterations, HashAlgorithmName.SHA256, HashBytes);
        return (Convert.ToBase64String(salt), Convert.ToBase64String(hash));
    }

    private static bool VerifyPassword(string password, string salt, string expectedHash)
    {
        var saltBytes = Convert.FromBase64String(salt);
        var expectedBytes = Convert.FromBase64String(expectedHash);
        var actualBytes = Rfc2898DeriveBytes.Pbkdf2(password, saltBytes, PasswordIterations, HashAlgorithmName.SHA256, HashBytes);
        return CryptographicOperations.FixedTimeEquals(actualBytes, expectedBytes);
    }

    private static string CreateToken()
        => Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));

    private static string HashToken(string token)
    {
        var bytes = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}

