// ReSharper disable CheckNamespace
// 命名空间故意 = TM，匹配原 Core/App/App.xaml.cs 的 `namespace TM { static class App { public static void Log(...) } }`。
// 源码包含 Services/* 后，所有 TM.App.Log("...") 调用会解析到这里。
namespace TM;

using TM.Web.LegacyBridge.Compatibility;

internal static class App
{
    public static bool IsDebugMode { get; set; }

    public static void Log(string message) => LegacyLogBridge.Write(message);
}
