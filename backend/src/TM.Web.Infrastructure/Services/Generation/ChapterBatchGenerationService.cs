using System.Collections.Concurrent;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;

namespace TM.Web.Infrastructure.Services.Generation;

public sealed class ChapterBatchGenerationService : IChapterBatchGenerationService
{
    private readonly IChapterBatchGenerationJobQueue _queue;
    private readonly ConcurrentDictionary<string, ChapterBatchGenerationJobState> _jobs = new();

    public ChapterBatchGenerationService(IChapterBatchGenerationJobQueue queue)
    {
        _queue = queue;
    }

    public async Task<ChapterBatchGenerationAcceptedDto> QueueAsync(ChapterBatchGenerationRequest request, CancellationToken ct = default)
    {
        Validate(request);

        var jobId = $"chap_batch_{Guid.NewGuid():N}"[..30];
        var queuedAt = DateTime.UtcNow;
        var state = new ChapterBatchGenerationJobState(jobId, request, queuedAt);
        state.AddLog("任务已加入后台队列。");
        _jobs[jobId] = state;

        await _queue.EnqueueAsync(new ChapterBatchGenerationJob(jobId, request, queuedAt), ct);

        return new ChapterBatchGenerationAcceptedDto
        {
            JobId = jobId,
            Status = state.Status,
            QueuedAt = queuedAt
        };
    }

    public ChapterBatchGenerationJobStatusDto? GetStatus(string jobId)
        => _jobs.TryGetValue(jobId, out var state) ? state.ToDto() : null;

    public IReadOnlyList<ChapterBatchGenerationJobStatusDto> ListRecent(string? projectId = null, int take = 20)
    {
        take = Math.Clamp(take, 1, 100);
        return _jobs.Values
            .Where(x => string.IsNullOrWhiteSpace(projectId) || x.ProjectId == projectId)
            .OrderByDescending(x => x.QueuedAt)
            .Take(take)
            .Select(x => x.ToDto())
            .ToList();
    }

    public bool RequestCancel(string jobId)
    {
        if (!_jobs.TryGetValue(jobId, out var state))
        {
            return false;
        }

        state.RequestCancel();
        return true;
    }

    internal ChapterBatchGenerationJobState? TryGetState(string jobId)
        => _jobs.TryGetValue(jobId, out var state) ? state : null;

    private static void Validate(ChapterBatchGenerationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ProjectId)) throw new InvalidOperationException("项目 ID 不能为空。");
        if (string.IsNullOrWhiteSpace(request.VolumeId)) throw new InvalidOperationException("分卷 ID 不能为空。");
        if (request.StartChapterNumber <= 0) throw new InvalidOperationException("起始章节号必须大于 0。");
        request.Count = Math.Clamp(request.Count, 1, 200);
        if (request.AutoContinuityMode)
        {
            request.RerunValidationAfterSave = true;
            request.StopOnFailure = true;
        }
        if (string.IsNullOrWhiteSpace(request.Endpoint)) throw new InvalidOperationException("Endpoint 不能为空。");
        if (string.IsNullOrWhiteSpace(request.Model)) throw new InvalidOperationException("模型不能为空。");
        if (string.IsNullOrWhiteSpace(request.ConfigId) && string.IsNullOrWhiteSpace(request.ApiKey))
            throw new InvalidOperationException("请先选择已保存配置，或手动填写 API Key。");
    }
}

internal sealed class ChapterBatchGenerationJobState
{
    private readonly object _lock = new();
    private readonly List<string> _logs = new();

    public ChapterBatchGenerationJobState(string jobId, ChapterBatchGenerationRequest request, DateTime queuedAt)
    {
        JobId = jobId;
        ProjectId = request.ProjectId;
        VolumeId = request.VolumeId;
        StartChapterNumber = request.StartChapterNumber;
        Total = request.Count;
        QueuedAt = queuedAt;
    }

    public string JobId { get; }
    public string ProjectId { get; }
    public string VolumeId { get; }
    public int StartChapterNumber { get; }
    public int Total { get; }
    public string Status { get; private set; } = "queued";
    public int Completed { get; private set; }
    public int Failed { get; private set; }
    public int Skipped { get; private set; }
    public int CurrentChapterNumber { get; private set; }
    public string CurrentChapterTitle { get; private set; } = string.Empty;
    public string Message { get; private set; } = string.Empty;
    public DateTime QueuedAt { get; }
    public DateTime? StartedAt { get; private set; }
    public DateTime? FinishedAt { get; private set; }
    public bool CancelRequested { get; private set; }

    public void MarkRunning()
    {
        lock (_lock)
        {
            Status = "running";
            StartedAt ??= DateTime.UtcNow;
            Message = "后台章节生成正在运行。";
            AddLogLocked(Message);
        }
    }

    public void SetCurrent(int chapterNumber, string title)
    {
        lock (_lock)
        {
            CurrentChapterNumber = chapterNumber;
            CurrentChapterTitle = title;
            Message = $"正在生成第 {chapterNumber} 章：{title}";
        }
    }

    public void AddCompleted(int chapterNumber, string title)
    {
        lock (_lock)
        {
            Completed++;
            AddLogLocked($"已生成第 {chapterNumber} 章：{title}");
        }
    }

    public void AddFailed(int chapterNumber, string title, string message)
    {
        lock (_lock)
        {
            Failed++;
            AddLogLocked($"第 {chapterNumber} 章失败：{title}。{message}");
        }
    }

    public void AddSkipped(int chapterNumber, string title)
    {
        lock (_lock)
        {
            Skipped++;
            AddLogLocked($"已跳过第 {chapterNumber} 章：{title}，已有正文。");
        }
    }

    public void AddCreated(int chapterNumber, string title)
    {
        lock (_lock)
        {
            AddLogLocked($"已创建第 {chapterNumber} 章：{title}");
        }
    }

    public void AddLog(string message)
    {
        lock (_lock)
        {
            AddLogLocked(message);
        }
    }

    public void RequestCancel()
    {
        lock (_lock)
        {
            CancelRequested = true;
            Message = "已请求取消，将在当前章节结束后停止。";
            AddLogLocked(Message);
        }
    }

    public void MarkCompleted()
    {
        lock (_lock)
        {
            Status = CancelRequested ? "cancelled" : Failed > 0 ? "failed" : "completed";
            FinishedAt = DateTime.UtcNow;
            CurrentChapterNumber = 0;
            CurrentChapterTitle = string.Empty;
            Message = Status switch
            {
                "cancelled" => "后台章节生成已取消。",
                "failed" => "后台章节生成已结束，存在失败章节。",
                _ => "后台章节生成已完成。"
            };
            AddLogLocked(Message);
        }
    }

    public ChapterBatchGenerationJobStatusDto ToDto()
    {
        lock (_lock)
        {
            return new ChapterBatchGenerationJobStatusDto
            {
                JobId = JobId,
                ProjectId = ProjectId,
                VolumeId = VolumeId,
                Status = Status,
                StartChapterNumber = StartChapterNumber,
                Total = Total,
                Completed = Completed,
                Failed = Failed,
                Skipped = Skipped,
                CurrentChapterNumber = CurrentChapterNumber,
                CurrentChapterTitle = CurrentChapterTitle,
                Message = Message,
                Logs = _logs.ToList(),
                QueuedAt = QueuedAt,
                StartedAt = StartedAt,
                FinishedAt = FinishedAt,
                CancelRequested = CancelRequested
            };
        }
    }

    private void AddLogLocked(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return;
        _logs.Insert(0, $"{DateTime.Now:HH:mm:ss} {message}");
        if (_logs.Count > 80)
        {
            _logs.RemoveRange(80, _logs.Count - 80);
        }
    }
}
