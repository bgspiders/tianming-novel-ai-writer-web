using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/tianming/protocols")]
public sealed class TianmingProtocolController : ControllerBase
{
    private readonly ITianmingProtocolService _protocols;

    public TianmingProtocolController(ITianmingProtocolService protocols)
    {
        _protocols = protocols;
    }

    [HttpGet]
    public ActionResult<IReadOnlyList<TianmingProtocolDescriptorDto>> List()
        => Ok(_protocols.ListProtocols());

    [HttpGet("knowledge-base")]
    public ActionResult<IReadOnlyList<TianmingKnowledgeBaseFileDto>> ListKnowledgeBaseFiles()
        => Ok(_protocols.ListKnowledgeBaseFiles());

    [HttpGet("knowledge-base/status")]
    public Task<TianmingKnowledgeBaseBindingStatusDto> GetKnowledgeBaseStatus(
        [FromQuery] string projectId,
        [FromQuery] string? sourceBookId,
        CancellationToken ct)
        => _protocols.GetKnowledgeBaseStatusAsync(projectId, sourceBookId, ct);

    [HttpGet("knowledge-base/{key}")]
    public Task<TianmingKnowledgeBaseFileDto> GetKnowledgeBaseFile(
        string key,
        [FromQuery] string projectId,
        [FromQuery] string? sourceBookId,
        CancellationToken ct)
        => _protocols.GetKnowledgeBaseFileAsync(key, projectId, sourceBookId, ct);

    [HttpGet("knowledge-base/export")]
    public Task<IReadOnlyList<TianmingKnowledgeBaseFileDto>> ExportKnowledgeBase(
        [FromQuery] string projectId,
        [FromQuery] string? sourceBookId,
        CancellationToken ct)
        => _protocols.ExportKnowledgeBaseAsync(projectId, sourceBookId, ct);

    [HttpPost("knowledge-base/import")]
    public Task<TianmingKnowledgeBaseFileDto> ImportKnowledgeBase(
        [FromBody] TianmingKnowledgeBaseImportRequest request,
        CancellationToken ct)
        => _protocols.ImportKnowledgeBaseFileAsync(request, ct);

    [HttpPost("run")]
    public Task<TianmingProtocolResultDto> Run([FromBody] TianmingProtocolRequest request, CancellationToken ct)
        => _protocols.RunAsync(request, ct);
}
