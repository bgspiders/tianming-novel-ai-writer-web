using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers.Design;

[ApiController]
[Route("api/design/volume-designs")]
public class VolumeDesignsController : ControllerBase
{
    private readonly IVolumeDesignService _svc;
    public VolumeDesignsController(IVolumeDesignService svc) => _svc = svc;

    [HttpGet]
    public Task<IReadOnlyList<VolumeDesignDto>> List(
        [FromQuery] string? categoryId,
        [FromQuery] string? sourceBookId,
        [FromQuery] string? keyword,
        [FromQuery] bool? isEnabled,
        CancellationToken ct)
        => _svc.ListAsync(new DesignListQuery(categoryId, sourceBookId, keyword, isEnabled), ct);

    [HttpGet("{id}")]
    public async Task<ActionResult<VolumeDesignDto>> Get(string id, CancellationToken ct)
    {
        var dto = await _svc.GetAsync(id, ct);
        return dto == null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<VolumeDesignDto>> Create([FromBody] VolumeDesignUpsertDto input, CancellationToken ct)
    {
        var created = await _svc.CreateAsync(input, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public Task<VolumeDesignDto> Update(string id, [FromBody] VolumeDesignUpsertDto input, CancellationToken ct)
        => _svc.UpdateAsync(id, input, ct);

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        await _svc.DeleteAsync(id, ct);
        return NoContent();
    }
}
