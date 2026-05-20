namespace TM.Web.Application.Dtos.Generate;

public sealed class ChapterDraftRequest
{
    public string RunId { get; set; } = string.Empty;

    public string ProjectId { get; set; } = string.Empty;

    public string VolumeId { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;

    public string Endpoint { get; set; } = string.Empty;

    public string? ProviderId { get; set; }

    public string? ApiKeyId { get; set; }

    public string ApiKey { get; set; } = string.Empty;

    public string Model { get; set; } = string.Empty;

    public string? SystemPrompt { get; set; }

    public string Prompt { get; set; } = string.Empty;

    public float? Temperature { get; set; }

    public int? MaxTokens { get; set; }

    public int MaxRewriteAttempts { get; set; } = 2;

    public bool SaveToChapter { get; set; } = true;
}

public sealed class ChapterDraftResult
{
    public string RunId { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;

    public int ChunkCount { get; set; }

    public int CharCount { get; set; }

    public string? FinishReason { get; set; }

    public long ElapsedMs { get; set; }

    public string? Model { get; set; }

    public string? ContentFilePath { get; set; }

    public int WordCount { get; set; }

    public bool SavedToChapter { get; set; }

    public string? GenerationRecordId { get; set; }
}
