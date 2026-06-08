namespace TM.Web.Application.Dtos.Generate;

public sealed class GenerationCheckItemDto
{
    public string Code { get; set; } = string.Empty;

    public string Severity { get; set; } = "warning";

    public string Message { get; set; } = string.Empty;

    public string Suggestion { get; set; } = string.Empty;
}

public sealed class GenerationPreflightRequest
{
    public string ProjectId { get; set; } = string.Empty;

    public string? VolumeId { get; set; }

    public string? ChapterId { get; set; }

    public bool RequireChapterPlan { get; set; } = true;

    public bool RequireSceneBlueprints { get; set; } = true;
}

public sealed class GenerationPreflightResult
{
    public string Id { get; set; } = string.Empty;

    public string ProjectId { get; set; } = string.Empty;

    public string? VolumeId { get; set; }

    public string? ChapterId { get; set; }

    public bool Passed { get; set; }

    public int FatalCount { get; set; }

    public int WarningCount { get; set; }

    public List<GenerationCheckItemDto> Items { get; set; } = new();

    public DateTime CreatedAt { get; set; }
}

public sealed class EnsureSceneBlueprintsRequest
{
    public string ProjectId { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;
}

public sealed class EnsureSceneBlueprintsResult
{
    public string ProjectId { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;

    public int CreatedCount { get; set; }

    public int ExistingCount { get; set; }

    public List<ChapterBatchGenerationScenePreviewDto> Scenes { get; set; } = new();
}

public sealed class ConfirmChapterGenerationPreviewRequest
{
    public string ProjectId { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;

    public ChapterBatchGenerationPreviewItemDto Preview { get; set; } = new();
}

public sealed class ConfirmChapterGenerationPreviewResult
{
    public string ProjectId { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Summary { get; set; } = string.Empty;

    public int SceneCount { get; set; }

    public List<ChapterBatchGenerationScenePreviewDto> Scenes { get; set; } = new();
}

public sealed class SceneDraftRequest
{
    public string RunId { get; set; } = string.Empty;

    public string ProjectId { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;

    public int SceneNumber { get; set; }

    public string? ConfigId { get; set; }

    public string Endpoint { get; set; } = string.Empty;

    public string? ProviderId { get; set; }

    public string? ApiKeyId { get; set; }

    public string ApiKey { get; set; } = string.Empty;

    public string Model { get; set; } = string.Empty;

    public string? SystemPrompt { get; set; }

    public string Prompt { get; set; } = string.Empty;

    public float? Temperature { get; set; }

    public int? MaxTokens { get; set; }
}

public sealed class SceneDraftResult
{
    public string RecordId { get; set; } = string.Empty;

    public string RunId { get; set; } = string.Empty;

    public string ProjectId { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;

    public int SceneNumber { get; set; }

    public string SceneTitle { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public int CharCount { get; set; }

    public string? FinishReason { get; set; }

    public long ElapsedMs { get; set; }

    public bool Success { get; set; }

    public string? Error { get; set; }
}

public sealed class SceneComposeRequest
{
    public string ProjectId { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;

    public bool SaveToChapter { get; set; } = true;
}

public sealed class SceneComposeResult
{
    public string ProjectId { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;

    public int SceneCount { get; set; }

    public int WordCount { get; set; }

    public string Content { get; set; } = string.Empty;

    public bool SavedToChapter { get; set; }
}

public sealed class ChapterAnalysisRequest
{
    public string ProjectId { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;

    public int MinWordCount { get; set; } = 2500;

    public int MaxDuplicateTitleWindow { get; set; } = 5;

    public bool UpdateChapterSummary { get; set; } = true;
}

public sealed class ChapterAnalysisResult
{
    public string Id { get; set; } = string.Empty;

    public string ProjectId { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;

    public bool Passed { get; set; }

    public bool ShouldPauseBatch { get; set; }

    public int WordCount { get; set; }

    public int CoherenceScore { get; set; }

    public int QualityScore { get; set; }

    public string Summary { get; set; } = string.Empty;

    public List<GenerationCheckItemDto> Items { get; set; } = new();

    public DateTime CreatedAt { get; set; }
}

public sealed class GenerationFlowStatusDto
{
    public string ProjectId { get; set; } = string.Empty;

    public string? SourceBookId { get; set; }

    public List<GenerationFlowStepStatusDto> Steps { get; set; } = new();

    public string NextSuggestion { get; set; } = string.Empty;
}

public sealed class GenerationFlowStepStatusDto
{
    public string Key { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Status { get; set; } = "pending";

    public int Count { get; set; }

    public string Message { get; set; } = string.Empty;

    public string Path { get; set; } = string.Empty;

    public DateTime? LastUpdatedAt { get; set; }
}

public sealed class PromptRunSnapshotDto
{
    public string Id { get; set; } = string.Empty;

    public string RunId { get; set; } = string.Empty;

    public string ProjectId { get; set; } = string.Empty;

    public string? ChapterId { get; set; }

    public string? WorkflowId { get; set; }

    public string? StepKey { get; set; }

    public string Source { get; set; } = string.Empty;

    public string Model { get; set; } = string.Empty;

    public float? Temperature { get; set; }

    public int? MaxTokens { get; set; }

    public string ContextHash { get; set; } = string.Empty;

    public string ContextSummary { get; set; } = string.Empty;

    public string PromptSummary { get; set; } = string.Empty;

    public string OutputSummary { get; set; } = string.Empty;

    public bool Success { get; set; }

    public string Error { get; set; } = string.Empty;

    public long ElapsedMs { get; set; }

    public DateTime CreatedAt { get; set; }
}
