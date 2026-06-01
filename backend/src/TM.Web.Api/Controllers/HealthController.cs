using System.Reflection;
using Microsoft.AspNetCore.Mvc;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class HealthController : ControllerBase
{
    private static readonly string AppVersion =
        Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "0.0.0";

    private readonly IHostEnvironment _env;

    public HealthController(IHostEnvironment env)
    {
        _env = env;
    }

    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new
        {
            status = "ok",
            version = AppVersion,
            env = _env.EnvironmentName,
            time = DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm:ss zzz"),
            timeUtc = DateTimeOffset.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
        });
    }
}
