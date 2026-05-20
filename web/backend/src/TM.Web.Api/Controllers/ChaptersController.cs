using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/chapters")]
public class ChaptersController : ControllerBase
{
    private readonly IChapterService _chapters;

    public ChaptersController(IChapterService chapters) => _chapters = chapters;

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
}

public sealed class SaveChapterContentRequest
{
    public string? Content { get; set; }
    public string? Status { get; set; }
}
