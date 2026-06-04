using FluentAssertions;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;
using TM.Web.Infrastructure.Services.Generation;
using Xunit;

namespace TM.Web.Tests;

public class ChapterBatchGenerationAutoModeTests
{
    [Fact]
    public async Task QueueAsync_auto_continuity_mode_enforces_validation_and_failure_stop()
    {
        var queue = new CapturingChapterBatchGenerationJobQueue();
        var service = new ChapterBatchGenerationService(queue);

        var accepted = await service.QueueAsync(new ChapterBatchGenerationRequest
        {
            ProjectId = "project-1",
            VolumeId = "volume-1",
            StartChapterNumber = 1,
            Count = 5,
            CreateMissing = true,
            AutoContinuityMode = true,
            RerunValidationAfterSave = false,
            StopOnFailure = false,
            Endpoint = "https://example.com/v1",
            ApiKey = "sk-test",
            Model = "test-model"
        });

        accepted.JobId.Should().NotBeEmpty();
        queue.LastJob.Should().NotBeNull();
        queue.LastJob!.Request.AutoContinuityMode.Should().BeTrue();
        queue.LastJob.Request.RerunValidationAfterSave.Should().BeTrue();
        queue.LastJob.Request.StopOnFailure.Should().BeTrue();
    }

    private sealed class CapturingChapterBatchGenerationJobQueue : IChapterBatchGenerationJobQueue
    {
        public ChapterBatchGenerationJob? LastJob { get; private set; }

        public ValueTask EnqueueAsync(ChapterBatchGenerationJob job, CancellationToken ct = default)
        {
            LastJob = job;
            return ValueTask.CompletedTask;
        }

        public ValueTask<ChapterBatchGenerationJob> DequeueAsync(CancellationToken ct)
            => throw new NotSupportedException();
    }
}
