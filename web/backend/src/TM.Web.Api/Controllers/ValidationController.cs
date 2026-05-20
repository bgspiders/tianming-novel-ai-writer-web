using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Validation;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/validation")]
public class ValidationController : ControllerBase
{
    private readonly IValidationService _validation;

    public ValidationController(IValidationService validation) => _validation = validation;

    [HttpPost("run")]
    public Task<ValidationSummaryDto> Run([FromBody] ValidationRunRequest request, CancellationToken ct)
        => _validation.RunAsync(request, ct);

    [HttpGet("summaries")]
    public Task<IReadOnlyList<ValidationSummaryDto>> ListSummaries(
        [FromQuery] string projectId,
        [FromQuery] int? volumeNumber,
        CancellationToken ct)
        => _validation.ListSummariesAsync(projectId, volumeNumber, ct);

    [HttpGet("reports")]
    public Task<IReadOnlyList<ValidationReportDto>> ListReports(
        [FromQuery] string projectId,
        [FromQuery] int? volumeNumber,
        [FromQuery] string? chapterId,
        [FromQuery] int take,
        CancellationToken ct)
        => _validation.ListReportsAsync(projectId, volumeNumber, chapterId, take <= 0 ? 100 : take, ct);

    [HttpPut("reports/{reportId}/chapter-status")]
    public Task<ValidationReportStatusUpdateResult> UpdateReportChapterStatus(
        string reportId,
        [FromBody] ValidationReportStatusUpdateRequest request,
        CancellationToken ct)
        => _validation.UpdateReportChapterStatusAsync(reportId, request, ct);

    [HttpGet("facts")]
    public Task<FactSnapshotDto> GetFactSnapshot(
        [FromQuery] string projectId,
        [FromQuery] int? volumeNumber,
        CancellationToken ct)
        => _validation.GetFactSnapshotAsync(projectId, volumeNumber, ct);
}
