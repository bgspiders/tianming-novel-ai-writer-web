using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers.Design;

[ApiController]
[Route("api/design/chapter-blueprints")]
public class ChapterBlueprintsController : ControllerBase
{
    private readonly IChapterBlueprintService _svc;
    public ChapterBlueprintsController(IChapterBlueprintService svc) => _svc = svc;

    [HttpGet]
    public Task<IReadOnlyList<ChapterBlueprintDto>> List(
        [FromQuery] string? categoryId,
        [FromQuery] string? sourceBookId,
        [FromQuery] string? keyword,
        [FromQuery] bool? isEnabled,
        CancellationToken ct)
        => _svc.ListAsync(new DesignListQuery(categoryId, sourceBookId, keyword, isEnabled), ct);

    [HttpGet("{id}")]
    public async Task<ActionResult<ChapterBlueprintDto>> Get(string id, CancellationToken ct)
    {
        var dto = await _svc.GetAsync(id, ct);
        return dto == null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<ChapterBlueprintDto>> Create([FromBody] ChapterBlueprintUpsertDto input, CancellationToken ct)
    {
        var created = await _svc.CreateAsync(input, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public Task<ChapterBlueprintDto> Update(string id, [FromBody] ChapterBlueprintUpsertDto input, CancellationToken ct)
        => _svc.UpdateAsync(id, input, ct);

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        await _svc.DeleteAsync(id, ct);
        return NoContent();
    }
}
