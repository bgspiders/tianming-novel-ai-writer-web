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
