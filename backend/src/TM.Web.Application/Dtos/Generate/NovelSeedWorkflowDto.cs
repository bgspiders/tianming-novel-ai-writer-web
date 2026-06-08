namespace TM.Web.Application.Dtos.Generate;

public sealed class NovelSeedWorkflowCreateRequest
{
    public NovelSeedRequest Request { get; set; } = new();
}

public sealed class NovelSeedWorkflowUpdateRequest
{
    public NovelSeedRequest Request { get; set; } = new();
}

public sealed record NovelSeedWorkflowDto(
    string Id,
    string Status,
    NovelSeedRequest Request,
    string? ProjectId,
    string? Error,
    IReadOnlyList<NovelSeedWorkflowStepDto> Steps,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record NovelSeedWorkflowStepDto(
    string Id,
    string WorkflowId,
    string StepKey,
    string Title,
    int SortOrder,
    string Status,
    bool IsConfirmed,
    string Prompt,
    string Output,
    string? Error,
    DateTime? StartedAt,
    DateTime? FinishedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed class NovelSeedWorkflowStepPreviewDto
{
    public string WorkflowId { get; set; } = string.Empty;

    public string StepKey { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public IReadOnlyList<NovelSeedWorkflowPreviewItemDto> Items { get; set; } = Array.Empty<NovelSeedWorkflowPreviewItemDto>();
}

public sealed class NovelSeedWorkflowPreviewItemDto
{
    public string Key { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Summary { get; set; } = string.Empty;

    public string RawJson { get; set; } = string.Empty;
}

public sealed class NovelSeedWorkflowStepRewriteRequest
{
    public string ItemKey { get; set; } = string.Empty;

    public string Instruction { get; set; } = string.Empty;
}
