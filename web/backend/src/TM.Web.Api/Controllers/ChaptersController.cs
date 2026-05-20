using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Editor;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/chapters")]
public class ChaptersController : ControllerBase
{
    private readonly IChapterEditorService _chapters;

    public ChaptersController(IChapterEditorService chapters) => _chapters = chapters;

    [HttpGet]
    public Task<IReadOnlyList<ChapterListItemDto>> List(
        [FromQuery] string? projectId,
        [FromQuery] string? sourceBookId,
        [FromQuery] string? keyword,
        CancellationToken ct)
        => _chapters.ListAsync(projectId, sourceBookId, keyword, ct);

    [HttpGet("{id}")]
    public async Task<ActionResult<ChapterDetailDto>> Get(string id, CancellationToken ct)
    {
        var dto = await _chapters.GetAsync(id, ct);
        return dto == null ? NotFound() : Ok(dto);
    }

    [HttpPut("{id}/content")]
    public async Task<ActionResult<ChapterDetailDto>> UpdateContent(
        string id,
        [FromBody] ChapterContentUpdateDto input,
        CancellationToken ct)
    {
        var dto = await _chapters.UpdateContentAsync(id, input, ct);
        return Ok(dto);
    }

    [HttpGet("{id}/versions")]
    public Task<IReadOnlyList<ChapterVersionItemDto>> Versions(string id, CancellationToken ct)
        => _chapters.GetVersionsAsync(id, ct);

    [HttpGet("{id}/versions/{versionId}")]
    public async Task<ActionResult<ChapterVersionDetailDto>> Version(string id, string versionId, CancellationToken ct)
    {
        var dto = await _chapters.GetVersionAsync(id, versionId, ct);
        return dto == null ? NotFound() : Ok(dto);
    }

    [HttpPost("{id}/restore-version")]
    public async Task<ActionResult<ChapterDetailDto>> RestoreVersion(
        string id,
        [FromBody] RestoreChapterVersionRequestDto input,
        CancellationToken ct)
    {
        var dto = await _chapters.RestoreVersionAsync(id, input.VersionId, ct);
        return Ok(dto);
    }
}
