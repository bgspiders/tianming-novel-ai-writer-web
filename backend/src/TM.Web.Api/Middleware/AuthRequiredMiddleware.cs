using TM.Web.Infrastructure.Services.Auth;
using TM.Web.Application.Services;

namespace TM.Web.Api.Middleware;

public sealed class AuthRequiredMiddleware
{
    private readonly RequestDelegate _next;

    public AuthRequiredMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IAuthService auth)
    {
        if (!RequiresAuth(context.Request))
        {
            await _next(context);
            return;
        }

        var token = context.Request.Cookies.TryGetValue(AuthService.CookieName, out var value) ? value : null;
        var status = await auth.GetStatusAsync(token, context.RequestAborted);
        if (status.IsAuthenticated)
        {
            await _next(context);
            return;
        }

        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new
        {
            title = status.IsInitialized ? "未登录" : "未初始化",
            detail = status.IsInitialized ? "请先登录后再继续操作。" : "请先完成管理员账号初始化。"
        }, context.RequestAborted);
    }

    private static bool RequiresAuth(HttpRequest request)
    {
        if (!request.Path.StartsWithSegments("/api")) return false;
        if (request.Path.StartsWithSegments("/api/auth")) return false;
        return true;
    }
}
