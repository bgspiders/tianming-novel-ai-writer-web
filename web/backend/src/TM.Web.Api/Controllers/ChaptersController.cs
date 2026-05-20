using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Dtos.Editor;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/chapters")]
public class ChaptersController : ControllerBase
{
    private readonly IChapterService _chapters;
    private readonly IChapterEditorService _chapterEditor;

    public ChaptersController(IChapterService chapters, IChapterEditorService chapterEditor)
    {
        _chapters = chapters;
        _chapterEditor = chapterEditor;
    }

    [HttpGet]
    public Task<IReadOnlyList<ChapterDto>> List(
        [FromQuery] string projectId,
        [FromQuery] string? volumeId,
        CancellationToken ct)
        => _chapters.ListAsync(projectId, volumeId, ct);

    [HttpGet("{id}")]
    public async Task<ActionResult<ChapterDto>> Get(string id, CancellationToken ct)
    {
        var dto = await _chapters.GetAsync(id, ct);
        return dto == null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<ChapterDto>> Create([FromBody] ChapterUpsertDto input, CancellationToken ct)
    {
        var created = await _chapters.CreateAsync(input, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public Task<ChapterDto> Update(string id, [FromBody] ChapterUpsertDto input, CancellationToken ct)
        => _chapters.UpdateAsync(id, input, ct);

    [HttpPut("{id}/content")]
    public Task<ChapterDto> SaveContent(string id, [FromBody] SaveChapterContentRequest input, CancellationToken ct)
        => _chapters.SaveContentAsync(id, input.Content ?? string.Empty, input.Status ?? "drafted", ct);

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        await _chapters.DeleteAsync(id, ct);
        return NoContent();
    }

    [HttpGet("editor-list")]
    public Task<IReadOnlyList<ChapterListItemDto>> ListForEditor(
        [FromQuery] string? projectId,
        [FromQuery] string? sourceBookId,
        [FromQuery] string? keyword,
        CancellationToken ct)
        => _chapterEditor.ListAsync(projectId, sourceBookId, keyword, ct);

    [HttpGet("{id}/editor")]
    public async Task<ActionResult<ChapterDetailDto>> GetForEditor(string id, CancellationToken ct)
    {
        var dto = await _chapterEditor.GetAsync(id, ct);
        return dto == null ? NotFound() : Ok(dto);
    }

    [HttpPut("{id}/editor-content")]
    public Task<ChapterDetailDto> UpdateEditorContent(
        string id,
        [FromBody] ChapterContentUpdateDto input,
        CancellationToken ct)
        => _chapterEditor.UpdateContentAsync(id, input, ct);

    [HttpGet("{id}/versions")]
    public Task<IReadOnlyList<ChapterVersionItemDto>> Versions(string id, CancellationToken ct)
        => _chapterEditor.GetVersionsAsync(id, ct);

    [HttpGet("{id}/versions/{versionId}")]
    public async Task<ActionResult<ChapterVersionDetailDto>> Version(string id, string versionId, CancellationToken ct)
    {
        var dto = await _chapterEditor.GetVersionAsync(id, versionId, ct);
        return dto == null ? NotFound() : Ok(dto);
    }

    [HttpPost("{id}/restore-version")]
    public Task<ChapterDetailDto> RestoreVersion(
        string id,
        [FromBody] RestoreChapterVersionRequestDto input,
        CancellationToken ct)
        => _chapterEditor.RestoreVersionAsync(id, input.VersionId, ct);
}

public sealed class SaveChapterContentRequest
{
    public string? Content { get; set; }
    public string? Status { get; set; }
}
