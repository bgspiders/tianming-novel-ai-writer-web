using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace TM.Web.LegacyBridge.Compatibility;

/// <summary>
/// 进程级日志中转。原 Services 代码到处调 TM.App.Log(string)。
/// Web 化后 TM.App 改为命名空间 TM 下的静态类，转发到 ILogger 或 Console。
/// 详见 [复用清单.md](../../../../../../docs/复用清单.md) 三.1 节。
/// </summary>
public static class LegacyLogBridge
{
    private static ILogger? _logger;

    public static void Wire(IServiceProvider services)
    {
        _logger = services.GetService<ILoggerFactory>()?.CreateLogger("TM.Legacy");
    }

    public static void Write(string message)
    {
        if (_logger != null)
        {
            _logger.LogInformation("{Message}", message);
        }
        else
        {
            Console.WriteLine(message);
        }
    }
}
