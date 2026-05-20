using TM.Web.Application.Dtos.Validation;

namespace TM.Web.Application.Services;

public interface IValidationService
{
    Task<ValidationSummaryDto> RunAsync(ValidationRunRequest request, CancellationToken ct = default);

    Task<IReadOnlyList<ValidationSummaryDto>> ListSummariesAsync(
        string projectId,
        int? volumeNumber = null,
        CancellationToken ct = default);

    Task<IReadOnlyList<ValidationReportDto>> ListReportsAsync(
        string projectId,
        int? volumeNumber = null,
        string? chapterId = null,
        int take = 100,
        CancellationToken ct = default);

    Task<ValidationReportStatusUpdateResult> UpdateReportChapterStatusAsync(
        string reportId,
        ValidationReportStatusUpdateRequest request,
        CancellationToken ct = default);

    Task<FactSnapshotDto> GetFactSnapshotAsync(
        string projectId,
        int? volumeNumber = null,
        CancellationToken ct = default);
}
