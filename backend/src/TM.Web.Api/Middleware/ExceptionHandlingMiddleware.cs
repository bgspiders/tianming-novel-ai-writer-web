using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace TM.Web.Api.Middleware;

public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private readonly IHostEnvironment _env;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger,
        IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            _logger.LogInformation("Request cancelled by client: {Path}", context.Request.Path);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception at {Path}", context.Request.Path);
            await WriteProblemAsync(context, ex);
        }
    }

    private async Task WriteProblemAsync(HttpContext context, Exception ex)
    {
        if (context.Response.HasStarted)
        {
            return;
        }

        var (status, title) = ex switch
        {
            ArgumentException => ((int)HttpStatusCode.BadRequest, "Bad Request"),
            InvalidOperationException => ((int)HttpStatusCode.BadRequest, "Bad Request"),
            UnauthorizedAccessException => ((int)HttpStatusCode.Unauthorized, "Unauthorized"),
            KeyNotFoundException => ((int)HttpStatusCode.NotFound, "Not Found"),
            NotImplementedException => ((int)HttpStatusCode.NotImplemented, "Not Implemented"),
            _ => ((int)HttpStatusCode.InternalServerError, "Internal Server Error")
        };

        var problem = new ProblemDetails
        {
            Type = $"https://httpstatuses.io/{status}",
            Status = status,
            Title = title,
            Detail = ex.Message,
            Instance = context.Request.Path
        };

        if (_env.IsDevelopment())
        {
            problem.Extensions["exceptionType"] = ex.GetType().FullName;
            problem.Extensions["stackTrace"] = ex.StackTrace;
            problem.Extensions["rootCauseMessage"] = GetInnermostMessage(ex);
            problem.Extensions["exceptionChain"] = GetExceptionChain(ex);
        }

        context.Response.Clear();
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/problem+json; charset=utf-8";
        await context.Response.WriteAsync(
            JsonSerializer.Serialize(problem, new JsonSerializerOptions
            {
                WriteIndented = false,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            })
        );
    }

    private static string GetInnermostMessage(Exception ex)
    {
        var current = ex;
        while (current.InnerException is not null)
        {
            current = current.InnerException;
        }

        return current.Message;
    }

    private static IReadOnlyList<object> GetExceptionChain(Exception ex)
    {
        var chain = new List<object>();
        Exception? current = ex;
        while (current is not null)
        {
            chain.Add(new
            {
                type = current.GetType().FullName,
                message = current.Message,
                stackTrace = current.StackTrace
            });
            current = current.InnerException;
        }

        return chain;
    }
}
