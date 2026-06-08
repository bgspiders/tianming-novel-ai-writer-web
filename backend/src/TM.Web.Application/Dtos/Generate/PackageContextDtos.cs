namespace TM.Web.Application.Dtos.Generate;

public sealed record PackageContextRequest(
    string ProjectId,
    string? SourceBookId = null);

public sealed record PackageContextResult(
    string ManifestId,
    string ProjectId,
    int Version,
    string? SourceBookId,
    DateTime PublishedAt,
    int FileCount,
    int EnabledModuleCount,
    string Statistics);

public sealed class GenerationContextRequest
{
    public string ProjectId { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;

    public int? SceneNumber { get; set; }

    public string? SourceBookId { get; set; }

    public int RecentChapterCount { get; set; } = 10;
}

public sealed class GenerationContextSectionDto
{
    public string Level { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;
}

public sealed class GenerationContextResult
{
    public string ProjectId { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;

    public int? SceneNumber { get; set; }

    public string? SourceBookId { get; set; }

    public List<GenerationContextSectionDto> Sections { get; set; } = new();

    public string ContextText { get; set; } = string.Empty;
}
