// ReSharper disable CheckNamespace
// 命名空间匹配原 Framework/Common/Controls/Feedback/ 下的 GlobalToast 静态类。
// 原签名提供 Info/Success/Warning/Error 4 个静态方法，部分带 timeoutMs 重载。
// Web 化后转发到 ILogger（无 UI）+ NotificationHistory 表（阶段 10 通知模块实施时接入）。
namespace TM.Framework.UI;

using TM.Web.LegacyBridge.Compatibility;

public static class GlobalToast
{
    public static void Info(string title) => LegacyLogBridge.Write($"[Toast/Info] {title}");
    public static void Info(string title, string body) => LegacyLogBridge.Write($"[Toast/Info] {title}: {body}");
    public static void Info(string title, string body, int timeoutMs) => LegacyLogBridge.Write($"[Toast/Info/{timeoutMs}ms] {title}: {body}");

    public static void Success(string title) => LegacyLogBridge.Write($"[Toast/Success] {title}");
    public static void Success(string title, string body) => LegacyLogBridge.Write($"[Toast/Success] {title}: {body}");
    public static void Success(string title, string body, int timeoutMs) => LegacyLogBridge.Write($"[Toast/Success/{timeoutMs}ms] {title}: {body}");

    public static void Warning(string title) => LegacyLogBridge.Write($"[Toast/Warning] {title}");
    public static void Warning(string title, string body) => LegacyLogBridge.Write($"[Toast/Warning] {title}: {body}");
    public static void Warning(string title, string body, int timeoutMs) => LegacyLogBridge.Write($"[Toast/Warning/{timeoutMs}ms] {title}: {body}");

    public static void Error(string title) => LegacyLogBridge.Write($"[Toast/Error] {title}");
    public static void Error(string title, string body) => LegacyLogBridge.Write($"[Toast/Error] {title}: {body}");
    public static void Error(string title, string body, int timeoutMs) => LegacyLogBridge.Write($"[Toast/Error/{timeoutMs}ms] {title}: {body}");
}
