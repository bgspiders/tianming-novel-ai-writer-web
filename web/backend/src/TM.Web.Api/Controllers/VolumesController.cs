using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/volumes")]
public class VolumesController : ControllerBase
{
    private readonly IVolumeService _volumes;

    public VolumesController(IVolumeService volumes) => _volumes = volumes;

    [HttpGet]
    public Task<IReadOnlyList<VolumeDto>> List([FromQuery] string projectId, CancellationToken ct)
        => _volumes.ListAsync(projectId, ct);

    [HttpGet("{id}")]
    public async Task<ActionResult<VolumeDto>> Get(string id, CancellationToken ct)
    {
        var dto = await _volumes.GetAsync(id, ct);
        return dto == null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<VolumeDto>> Create([FromBody] VolumeUpsertDto input, CancellationToken ct)
    {
        var created = await _volumes.CreateAsync(input, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public Task<VolumeDto> Update(string id, [FromBody] VolumeUpsertDto input, CancellationToken ct)
        => _volumes.UpdateAsync(id, input, ct);

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        await _volumes.DeleteAsync(id, ct);
        return NoContent();
    }
}
