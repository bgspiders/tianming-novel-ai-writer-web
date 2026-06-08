using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Runtime;

public class ChapterBatchGenerationJobRecord : EntityBase
{
    public string JobId { get; set; } = string.Empty;

    public string ProjectId { get; set; } = string.Empty;

    public string VolumeId { get; set; } = string.Empty;

    public string Status { get; set; } = "queued";

    public int StartChapterNumber { get; set; }

    public int Total { get; set; }

    public int Completed { get; set; }

    public int Failed { get; set; }

    public int Skipped { get; set; }

    public int CurrentChapterNumber { get; set; }

    public string CurrentChapterTitle { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public string RequestJson { get; set; } = "{}";

    public bool CancelRequested { get; set; }

    public DateTime QueuedAt { get; set; } = DateTime.UtcNow;

    public DateTime? StartedAt { get; set; }

    public DateTime? FinishedAt { get; set; }
}
