namespace TM.Web.Application.Dtos.Import;

public record ImportRequest(string SourceStoragePath);

public record ImportReport(
    DateTime StartedAt,
    DateTime FinishedAt,
    string SourcePath,
    bool Success,
    IReadOnlyList<ImportTableSummary> Tables,
    IReadOnlyList<string> Warnings,
    IReadOnlyList<string> Errors);

public record ImportTableSummary(
    string Table,
    string SourceFile,
    int Read,
    int Inserted,
    int Updated,
    int Skipped);
