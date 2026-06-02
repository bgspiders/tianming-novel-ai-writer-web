namespace TM.Web.Application.Dtos.Generate;

public sealed class ChapterBatchGenerationRequest
{
    public string ProjectId { get; set; } = string.Empty;

    public string VolumeId { get; set; } = string.Empty;

    public int StartChapterNumber { get; set; } = 1;

    public int Count { get; set; } = 1;

    public bool CreateMissing { get; set; } = true;

    public bool OverwriteExisting { get; set; }

    public bool StopOnFailure { get; set; } = true;

    public string? ConfigId { get; set; }

    public string Endpoint { get; set; } = string.Empty;

    public string? ProviderId { get; set; }

    public string? ApiKeyId { get; set; }

    public string ApiKey { get; set; } = string.Empty;

    public string Model { get; set; } = string.Empty;

    public string? SystemPrompt { get; set; }

    public float? Temperature { get; set; }

    public int? MaxTokens { get; set; }

    public int MaxRewriteAttempts { get; set; } = 2;

    public string? ValidationReportId { get; set; }

    public bool RerunValidationAfterSave { get; set; }
}

public sealed class ChapterBatchGenerationAcceptedDto
{
    public string JobId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public DateTime QueuedAt { get; set; }
}

public sealed class ChapterBatchGenerationJobStatusDto
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

    public IReadOnlyList<string> Logs { get; set; } = Array.Empty<string>();

    public DateTime QueuedAt { get; set; }

    public DateTime? StartedAt { get; set; }

    public DateTime? FinishedAt { get; set; }

    public bool CancelRequested { get; set; }
}
