using System.Threading.Channels;
using TM.Web.Application.Services;

namespace TM.Web.Infrastructure.Services.Design;

public sealed class BookAnalysisBackgroundJobQueue : IBookAnalysisBackgroundJobQueue
{
    private readonly Channel<BookAnalysisBackgroundAnalyzeJob> _queue = Channel.CreateUnbounded<BookAnalysisBackgroundAnalyzeJob>(
        new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false
        });

    public ValueTask EnqueueAsync(BookAnalysisBackgroundAnalyzeJob job, CancellationToken ct = default)
        => _queue.Writer.WriteAsync(job, ct);

    public ValueTask<BookAnalysisBackgroundAnalyzeJob> DequeueAsync(CancellationToken ct)
        => _queue.Reader.ReadAsync(ct);
}
