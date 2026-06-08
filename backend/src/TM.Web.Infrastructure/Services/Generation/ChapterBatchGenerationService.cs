using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Runtime;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Generation;

public sealed class ChapterBatchGenerationService : IChapterBatchGenerationService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly IChapterBatchGenerationJobQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ConcurrentDictionary<string, ChapterBatchGenerationJobState> _jobs = new();

    public ChapterBatchGenerationService(IChapterBatchGenerationJobQueue queue, IServiceScopeFactory scopeFactory)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
    }

    public async Task<ChapterBatchGenerationAcceptedDto> QueueAsync(ChapterBatchGenerationRequest request, CancellationToken ct = default)
    {
        Validate(request);

        var jobId = $"chap_batch_{Guid.NewGuid():N}"[..30];
        var queuedAt = DateTime.UtcNow;
        var state = new ChapterBatchGenerationJobState(jobId, request, queuedAt);
        state.AddLog("任务已加入后台队列。");
        _jobs[jobId] = state;

        await using (var scope = _scopeFactory.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.ChapterBatchGenerationJobRecords.Add(new ChapterBatchGenerationJobRecord
            {
                JobId = jobId,
                ProjectId = request.ProjectId,
                VolumeId = request.VolumeId,
                Status = state.Status,
                StartChapterNumber = request.StartChapterNumber,
                Total = request.Count,
                RequestJson = JsonSerializer.Serialize(request, JsonOptions),
                QueuedAt = queuedAt,
                Message = "任务已加入后台队列。"
            });
            db.ChapterBatchGenerationJobLogs.Add(new ChapterBatchGenerationJobLog
            {
                JobId = jobId,
                ProjectId = request.ProjectId,
                Level = "info",
                Message = "任务已加入后台队列。"
            });
            await db.SaveChangesAsync(ct);
        }

        await _queue.EnqueueAsync(new ChapterBatchGenerationJob(jobId, request, queuedAt), ct);

        return new ChapterBatchGenerationAcceptedDto
        {
            JobId = jobId,
            Status = state.Status,
            QueuedAt = queuedAt
        };
    }

    public ChapterBatchGenerationJobStatusDto? GetStatus(string jobId)
    {
        if (_jobs.TryGetValue(jobId, out var state))
        {
            return state.ToDto();
        }

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var record = db.ChapterBatchGenerationJobRecords.FirstOrDefault(x => x.JobId == jobId);
        if (record != null && NormalizeStalePersistedJob(db, record))
        {
            db.SaveChanges();
        }

        return record == null ? null : ToDto(record, LoadLogs(db, jobId));
    }

    public IReadOnlyList<ChapterBatchGenerationJobStatusDto> ListRecent(string? projectId = null, int take = 20)
    {
        take = Math.Clamp(take, 1, 100);
        var memory = _jobs.Values
            .Where(x => string.IsNullOrWhiteSpace(projectId) || x.ProjectId == projectId)
            .Select(x => x.ToDto())
            .ToList();

        var memoryIds = memory.Select(x => x.JobId).ToHashSet(StringComparer.Ordinal);
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var persistedRecords = db.ChapterBatchGenerationJobRecords
            .Where(x => string.IsNullOrWhiteSpace(projectId) || x.ProjectId == projectId)
            .OrderByDescending(x => x.QueuedAt)
            .Take(take)
            .ToList()
            .Where(x => !memoryIds.Contains(x.JobId))
            .ToList();
        var changed = false;
        foreach (var record in persistedRecords)
        {
            changed |= NormalizeStalePersistedJob(db, record);
        }

        if (changed)
        {
            db.SaveChanges();
        }

        var persisted = persistedRecords
            .Select(x => ToDto(x, LoadLogs(db, x.JobId)))
            .ToList();

        return memory.Concat(persisted)
            .OrderByDescending(x => x.QueuedAt)
            .Take(take)
            .ToList();
    }

    public bool RequestCancel(string jobId)
    {
        if (!_jobs.TryGetValue(jobId, out var state))
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var record = db.ChapterBatchGenerationJobRecords.FirstOrDefault(x => x.JobId == jobId);
            if (record == null) return false;
            if (IsActiveStatus(record.Status))
            {
                CancelStalePersistedJob(db, record);
                db.SaveChanges();
            }

            return true;
        }

        state.RequestCancel();
        PersistStatus(state.ToDto(), "已请求取消，将在当前章节结束后停止。", "warning");
        return true;
    }

    internal ChapterBatchGenerationJobState? TryGetState(string jobId)
        => _jobs.TryGetValue(jobId, out var state) ? state : null;

    internal void PersistStatus(ChapterBatchGenerationJobStatusDto status, string? logMessage = null, string level = "info")
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var record = db.ChapterBatchGenerationJobRecords.FirstOrDefault(x => x.JobId == status.JobId);
        if (record is null) return;

        record.Status = status.Status;
        record.Completed = status.Completed;
        record.Failed = status.Failed;
        record.Skipped = status.Skipped;
        record.CurrentChapterNumber = status.CurrentChapterNumber;
        record.CurrentChapterTitle = status.CurrentChapterTitle;
        record.Message = status.Message;
        record.CancelRequested = status.CancelRequested;
        record.StartedAt = status.StartedAt;
        record.FinishedAt = status.FinishedAt;

        if (!string.IsNullOrWhiteSpace(logMessage))
        {
            db.ChapterBatchGenerationJobLogs.Add(new ChapterBatchGenerationJobLog
            {
                JobId = status.JobId,
                ProjectId = status.ProjectId,
                Level = level,
                Message = logMessage
            });
        }

        db.SaveChanges();
    }

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
        ValidatePreviewDiversity(request.PreviewItems);
    }

    private static void ValidatePreviewDiversity(IReadOnlyList<ChapterBatchGenerationPreviewItemDto> items)
    {
        var meaningful = items
            .Where(x => !string.IsNullOrWhiteSpace(x.Title) || !string.IsNullOrWhiteSpace(x.Summary))
            .OrderBy(x => x.ChapterNumber)
            .ToList();
        if (meaningful.Count < 3) return;

        var duplicatedTitles = meaningful
            .GroupBy(x => NormalizeForDiversity(x.Title))
            .Where(x => !string.IsNullOrWhiteSpace(x.Key) && x.Count() >= 2)
            .Select(x => $"{x.Key}({x.Count()}章)")
            .ToList();

        var duplicatedSummaries = meaningful
            .GroupBy(x => NormalizeForDiversity(x.Summary))
            .Where(x => !string.IsNullOrWhiteSpace(x.Key) && x.Count() >= 2)
            .Select(x => $"{x.Key[..Math.Min(24, x.Key.Length)]}({x.Count()}章)")
            .ToList();

        var adjacentSimilar = new List<string>();
        for (var i = 1; i < meaningful.Count; i++)
        {
            var previous = meaningful[i - 1];
            var current = meaningful[i];
            if (TextSimilarity(previous.Summary, current.Summary) >= 0.86)
            {
                adjacentSimilar.Add($"第{previous.ChapterNumber}-{current.ChapterNumber}章简介过于接近");
            }
        }

        if (duplicatedTitles.Count == 0 && duplicatedSummaries.Count == 0 && adjacentSimilar.Count < 2) return;

        var reasons = duplicatedTitles
            .Select(x => $"重复标题：{x}")
            .Concat(duplicatedSummaries.Select(x => $"重复简介：{x}"))
            .Concat(adjacentSimilar.Take(3))
            .Take(6);
        throw new InvalidOperationException($"批量生成前检测到章节标题/简介同质化：{string.Join("；", reasons)}。请先批量重写标题/简介，确认预览后再启动自动生成。");
    }

    private static string NormalizeForDiversity(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var normalized = Regex.Replace(value.Trim().ToLowerInvariant(), @"[\s\p{P}\p{S}]+", "");
        normalized = Regex.Replace(normalized, @"第?[一二三四五六七八九十百千万零\d]+章?", "");
        return normalized;
    }

    private static double TextSimilarity(string? left, string? right)
    {
        var a = NormalizeForDiversity(left);
        var b = NormalizeForDiversity(right);
        if (a.Length == 0 || b.Length == 0) return 0;
        if (a == b) return 1;

        var setA = a.EnumerateRunes().Select(x => x.Value).ToHashSet();
        var setB = b.EnumerateRunes().Select(x => x.Value).ToHashSet();
        var intersection = setA.Intersect(setB).Count();
        var union = setA.Union(setB).Count();
        return union == 0 ? 0 : intersection / (double)union;
    }

    private static IReadOnlyList<string> LoadLogs(AppDbContext db, string jobId)
        => db.ChapterBatchGenerationJobLogs.AsNoTracking()
            .Where(x => x.JobId == jobId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(80)
            .Select(x => $"{x.CreatedAt.ToLocalTime():HH:mm:ss} {x.Message}")
            .ToList();

    private static bool NormalizeStalePersistedJob(AppDbContext db, ChapterBatchGenerationJobRecord record)
    {
        if (!IsActiveStatus(record.Status)) return false;
        CancelStalePersistedJob(db, record);
        return true;
    }

    private static void CancelStalePersistedJob(AppDbContext db, ChapterBatchGenerationJobRecord record)
    {
        record.Status = "cancelled";
        record.CancelRequested = true;
        record.FinishedAt ??= DateTime.UtcNow;
        record.CurrentChapterNumber = 0;
        record.CurrentChapterTitle = string.Empty;
        record.Message = "服务已重启，原后台任务已停止；请重新启动批量生成。";
        db.ChapterBatchGenerationJobLogs.Add(new ChapterBatchGenerationJobLog
        {
            JobId = record.JobId,
            ProjectId = record.ProjectId,
            Level = "warning",
            Message = record.Message
        });
    }

    private static bool IsActiveStatus(string? status)
        => string.Equals(status, "queued", StringComparison.OrdinalIgnoreCase)
           || string.Equals(status, "running", StringComparison.OrdinalIgnoreCase);

    private static ChapterBatchGenerationJobStatusDto ToDto(
        ChapterBatchGenerationJobRecord record,
        IReadOnlyList<string> logs)
        => new()
        {
            JobId = record.JobId,
            ProjectId = record.ProjectId,
            VolumeId = record.VolumeId,
            Status = record.Status,
            StartChapterNumber = record.StartChapterNumber,
            Total = record.Total,
            Completed = record.Completed,
            Failed = record.Failed,
            Skipped = record.Skipped,
            CurrentChapterNumber = record.CurrentChapterNumber,
            CurrentChapterTitle = record.CurrentChapterTitle,
            Message = record.Message,
            Logs = logs,
            QueuedAt = record.QueuedAt,
            StartedAt = record.StartedAt,
            FinishedAt = record.FinishedAt,
            CancelRequested = record.CancelRequested
        };
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
