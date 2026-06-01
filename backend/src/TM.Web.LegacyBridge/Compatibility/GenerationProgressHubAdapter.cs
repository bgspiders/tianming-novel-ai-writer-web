using TM.Services.Framework.AI.SemanticKernel;
using TM.Web.Application.Services;

namespace TM.Web.LegacyBridge.Compatibility;

/// <summary>
/// 把原 Services 静态 GenerationProgressHub.Report(...) 桥接到 Web 注入式推送。
/// </summary>
public sealed class GenerationProgressHubAdapter : GenerationProgressHub.IProgressSink
{
    private readonly IGenerationNotifier _notifier;

    public GenerationProgressHubAdapter(IGenerationNotifier notifier)
    {
        _notifier = notifier;
    }

    public Task ReportAsync(string runId, string message)
        => _notifier.StatusAsync(runId, message);

    public static void Wire(IGenerationNotifier notifier)
        => GenerationProgressHub.Bind(new GenerationProgressHubAdapter(notifier));
}
