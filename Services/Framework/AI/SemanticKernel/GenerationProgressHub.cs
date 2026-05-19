using System;
using System.Threading;
using System.Threading.Tasks;

namespace TM.Services.Framework.AI.SemanticKernel
{
    /// <summary>
    /// 章节生成进度广播。
    ///
    /// **原 WPF 行为**：单进程单用户，全局静态 event ProgressReported，任意 Report 调用都通过此事件广播。
    ///
    /// **Web 化改造**（Web 多连接场景）：
    /// - 仍保留 `ProgressReported` 事件以兼容原有订阅者（WPF/单元测试）
    /// - 新增 `Bind(IProgressSink)` 绑定外部 Sink（如 SignalR notifier）
    /// - 用 AsyncLocal&lt;string&gt; CurrentRunId 隔离不同请求的进度流，避免串号
    /// - Web 启动期由 ASP.NET Core 注入：GenerationProgressHub.Bind(new SignalRSink(notifier));
    ///   每次开始一次章节生成前 GenerationProgressHub.SetRunId(runId);
    ///
    /// 详见 web/docs/复用清单.md 三.2 节。
    /// </summary>
    public static class GenerationProgressHub
    {
        public static event Action<string>? ProgressReported;

        private static IProgressSink? _sink;
        private static readonly AsyncLocal<string?> _currentRunId = new();

        /// <summary>外部 Sink 接口，由宿主项目（Web/WPF）注入实现。</summary>
        public interface IProgressSink
        {
            Task ReportAsync(string runId, string message);
        }

        /// <summary>由宿主项目启动期调用一次。设为 null 可解绑。</summary>
        public static void Bind(IProgressSink? sink) => _sink = sink;

        /// <summary>在当前异步上下文设置 runId，本次调用栈内的 Report 都会带上此 runId。</summary>
        public static void SetRunId(string? runId) => _currentRunId.Value = runId;

        public static string? CurrentRunId => _currentRunId.Value;

        public static void Report(string message)
        {
            // 旧路径：兼容 WPF 全局订阅
            ProgressReported?.Invoke(message);

            // 新路径：转发到注入 Sink（Web 场景下是 SignalR）
            var sink = _sink;
            var rid = _currentRunId.Value;
            if (sink != null && rid != null)
            {
                _ = sink.ReportAsync(rid, message);
            }
        }
    }
}
