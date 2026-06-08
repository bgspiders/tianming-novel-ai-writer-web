using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Core;
using TM.Web.Infrastructure.Services.Generation;
using Xunit;

namespace TM.Web.Tests;

public class ChapterBatchGenerationAutoModeTests
{
    [Fact]
    public async Task QueueAsync_auto_continuity_mode_enforces_validation_and_failure_stop()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;
        var queue = new CapturingChapterBatchGenerationJobQueue();
        await using var provider = BuildProvider(connection);
        var service = new ChapterBatchGenerationService(queue, provider.GetRequiredService<IServiceScopeFactory>());

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

    [Fact]
    public async Task QueueAsync_persists_job_and_log_for_refreshable_status()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;
        var project = new Project { Name = "长篇项目" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        db.AddRange(project, volume);
        await db.SaveChangesAsync();

        var queue = new CapturingChapterBatchGenerationJobQueue();
        await using var provider = BuildProvider(connection);
        var service = new ChapterBatchGenerationService(queue, provider.GetRequiredService<IServiceScopeFactory>());

        var accepted = await service.QueueAsync(new ChapterBatchGenerationRequest
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            StartChapterNumber = 10,
            Count = 3,
            CreateMissing = true,
            Endpoint = "https://example.com/v1",
            ApiKey = "sk-test",
            Model = "test-model"
        });

        db.ChapterBatchGenerationJobRecords.Should().ContainSingle(x =>
            x.JobId == accepted.JobId
            && x.ProjectId == project.Id
            && x.VolumeId == volume.Id
            && x.Status == "queued"
            && x.Total == 3);
        db.ChapterBatchGenerationJobLogs.Should().ContainSingle(x =>
            x.JobId == accepted.JobId && x.Message.Contains("任务已加入后台队列"));
        service.GetStatus(accepted.JobId)!.Logs.Should().Contain(x => x.Contains("任务已加入后台队列"));
    }

    [Fact]
    public async Task GetStatus_marks_persisted_running_job_cancelled_after_process_restart()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;
        var project = new Project { Name = "长篇项目" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        db.AddRange(project, volume);
        await db.SaveChangesAsync();

        var firstQueue = new CapturingChapterBatchGenerationJobQueue();
        await using var provider = BuildProvider(connection);
        var firstService = new ChapterBatchGenerationService(firstQueue, provider.GetRequiredService<IServiceScopeFactory>());
        var accepted = await firstService.QueueAsync(new ChapterBatchGenerationRequest
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            StartChapterNumber = 10,
            Count = 3,
            CreateMissing = true,
            Endpoint = "https://example.com/v1",
            ApiKey = "sk-test",
            Model = "test-model"
        });
        var record = db.ChapterBatchGenerationJobRecords.Single(x => x.JobId == accepted.JobId);
        record.Status = "running";
        record.Message = "后台章节生成正在运行。";
        record.StartedAt = DateTime.UtcNow.AddMinutes(-5);
        await db.SaveChangesAsync();

        var restartedService = new ChapterBatchGenerationService(
            new CapturingChapterBatchGenerationJobQueue(),
            provider.GetRequiredService<IServiceScopeFactory>());

        var status = restartedService.GetStatus(accepted.JobId);

        status.Should().NotBeNull();
        status!.Status.Should().Be("cancelled");
        status.CancelRequested.Should().BeTrue();
        status.Message.Should().Contain("服务已重启");
        await db.Entry(record).ReloadAsync();
        record.Status.Should().Be("cancelled");
    }

    [Fact]
    public async Task RequestCancel_cancels_persisted_running_job_when_memory_state_is_missing()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;
        var project = new Project { Name = "长篇项目" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        db.AddRange(project, volume);
        await db.SaveChangesAsync();

        var provider = BuildProvider(connection);
        await using var _provider = provider;
        var jobId = "chap_batch_restart_missing";
        db.ChapterBatchGenerationJobRecords.Add(new TM.Web.Domain.Entities.Runtime.ChapterBatchGenerationJobRecord
        {
            JobId = jobId,
            ProjectId = project.Id,
            VolumeId = volume.Id,
            Status = "running",
            StartChapterNumber = 1,
            Total = 3,
            Message = "后台章节生成正在运行。",
            StartedAt = DateTime.UtcNow.AddMinutes(-3)
        });
        await db.SaveChangesAsync();

        var service = new ChapterBatchGenerationService(
            new CapturingChapterBatchGenerationJobQueue(),
            provider.GetRequiredService<IServiceScopeFactory>());

        service.RequestCancel(jobId).Should().BeTrue();

        var record = db.ChapterBatchGenerationJobRecords.Single(x => x.JobId == jobId);
        await db.Entry(record).ReloadAsync();
        record.Status.Should().Be("cancelled");
        record.CancelRequested.Should().BeTrue();
        record.Message.Should().Contain("服务已重启");
    }

    [Fact]
    public void JobState_analysis_pause_is_failed_not_cancelled()
    {
        var state = new ChapterBatchGenerationJobState(
            "chap_batch_analysis_pause",
            new ChapterBatchGenerationRequest
            {
                ProjectId = "project-1",
                VolumeId = "volume-1",
                StartChapterNumber = 3,
                Count = 100
            },
            DateTime.UtcNow);

        state.MarkRunning();
        state.AddFailed(3, "买下一座废厂", "章节分析触发暂停：章节正文未充分落地场景蓝图。");
        state.MarkCompleted();

        var dto = state.ToDto();
        dto.Status.Should().Be("failed");
        dto.Completed.Should().Be(0);
        dto.Failed.Should().Be(1);
        dto.CancelRequested.Should().BeFalse();
        dto.Message.Should().Contain("存在失败章节");
    }

    [Fact]
    public async Task QueueAsync_blocks_severely_homogeneous_preview_items()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;
        var queue = new CapturingChapterBatchGenerationJobQueue();
        await using var provider = BuildProvider(connection);
        var service = new ChapterBatchGenerationService(queue, provider.GetRequiredService<IServiceScopeFactory>());

        var act = async () => await service.QueueAsync(new ChapterBatchGenerationRequest
        {
            ProjectId = "project-1",
            VolumeId = "volume-1",
            StartChapterNumber = 1,
            Count = 4,
            CreateMissing = true,
            Endpoint = "https://example.com/v1",
            ApiKey = "sk-test",
            Model = "test-model",
            PreviewItems =
            [
                new() { ChapterNumber = 1, Title = "冲突升级", Summary = "主角遭遇阻力，局势进一步升级。" },
                new() { ChapterNumber = 2, Title = "冲突升级", Summary = "主角遭遇阻力，局势进一步升级。" },
                new() { ChapterNumber = 3, Title = "冲突升级", Summary = "主角遭遇阻力，局势进一步升级。" },
                new() { ChapterNumber = 4, Title = "冲突升级", Summary = "主角遭遇阻力，局势进一步升级。" }
            ]
        });

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*标题/简介同质化*");
        queue.LastJob.Should().BeNull();
    }

    [Fact]
    public async Task QueueAsync_accepts_large_fallback_preview_without_title_or_summary_homogeneity()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;
        var project = new Project { Name = "长篇项目" };
        var volume = new Volume { ProjectId = project.Id, VolumeNumber = 1, Title = "第一卷" };
        db.AddRange(project, volume);
        await db.SaveChangesAsync();

        var previewItems = await ChapterBatchGenerationWorker.BuildPreviewAsync(
            db,
            new ChapterBatchGenerationPreviewRequest
            {
                ProjectId = project.Id,
                VolumeId = volume.Id,
                StartChapterNumber = 1,
                Count = 80,
                CreateMissing = true
            },
            CancellationToken.None);
        var queue = new CapturingChapterBatchGenerationJobQueue();
        await using var provider = BuildProvider(connection);
        var service = new ChapterBatchGenerationService(queue, provider.GetRequiredService<IServiceScopeFactory>());

        var accepted = await service.QueueAsync(new ChapterBatchGenerationRequest
        {
            ProjectId = project.Id,
            VolumeId = volume.Id,
            StartChapterNumber = 1,
            Count = 80,
            CreateMissing = true,
            Endpoint = "https://example.com/v1",
            ApiKey = "sk-test",
            Model = "test-model",
            PreviewItems = previewItems.ToList()
        });

        accepted.JobId.Should().NotBeEmpty();
        queue.LastJob.Should().NotBeNull();
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

    private static ServiceProvider BuildProvider(Microsoft.Data.Sqlite.SqliteConnection connection)
        => new ServiceCollection()
            .AddScoped(_ => new TM.Web.Infrastructure.Persistence.AppDbContext(TestDb.CreateOptions(connection)))
            .BuildServiceProvider();
}
