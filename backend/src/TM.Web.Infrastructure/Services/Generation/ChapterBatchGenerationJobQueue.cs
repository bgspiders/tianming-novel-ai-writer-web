using System.Threading.Channels;
using TM.Web.Application.Services;

namespace TM.Web.Infrastructure.Services.Generation;

public sealed class ChapterBatchGenerationJobQueue : IChapterBatchGenerationJobQueue
{
    private readonly Channel<ChapterBatchGenerationJob> _queue = Channel.CreateUnbounded<ChapterBatchGenerationJob>(
        new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false
        });

    public ValueTask EnqueueAsync(ChapterBatchGenerationJob job, CancellationToken ct = default)
        => _queue.Writer.WriteAsync(job, ct);

    public ValueTask<ChapterBatchGenerationJob> DequeueAsync(CancellationToken ct)
        => _queue.Reader.ReadAsync(ct);
}
