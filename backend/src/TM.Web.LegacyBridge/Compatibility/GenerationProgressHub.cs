using System.Threading.Tasks;

namespace TM.Services.Framework.AI.SemanticKernel;

public static class GenerationProgressHub
{
    private static IProgressSink? _sink;

    public interface IProgressSink
    {
        Task ReportAsync(string runId, string message);
    }

    public static void Bind(IProgressSink sink)
    {
        _sink = sink;
    }

    public static Task ReportAsync(string runId, string message)
        => _sink?.ReportAsync(runId, message) ?? Task.CompletedTask;
}
