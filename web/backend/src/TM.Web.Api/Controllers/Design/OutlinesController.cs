using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers.Design;

[ApiController]
[Route("api/design/outlines")]
public class OutlinesController : ControllerBase
{
    private readonly IOutlineService _svc;
    public OutlinesController(IOutlineService svc) => _svc = svc;

    [HttpGet]
    public Task<IReadOnlyList<OutlineDto>> List(
        [FromQuery] string? categoryId,
        [FromQuery] string? sourceBookId,
        [FromQuery] string? keyword,
        [FromQuery] bool? isEnabled,
        CancellationToken ct)
        => _svc.ListAsync(new DesignListQuery(categoryId, sourceBookId, keyword, isEnabled), ct);

    [HttpGet("{id}")]
    public async Task<ActionResult<OutlineDto>> Get(string id, CancellationToken ct)
    {
        var dto = await _svc.GetAsync(id, ct);
        return dto == null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<OutlineDto>> Create([FromBody] OutlineUpsertDto input, CancellationToken ct)
    {
        var created = await _svc.CreateAsync(input, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public Task<OutlineDto> Update(string id, [FromBody] OutlineUpsertDto input, CancellationToken ct)
        => _svc.UpdateAsync(id, input, ct);

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        await _svc.DeleteAsync(id, ct);
        return NoContent();
    }
}
