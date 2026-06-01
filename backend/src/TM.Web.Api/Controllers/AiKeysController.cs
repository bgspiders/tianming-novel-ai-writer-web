using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Ai;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/ai-keys")]
public class AiKeysController : ControllerBase
{
    private readonly IAiApiKeyService _keys;

    public AiKeysController(IAiApiKeyService keys)
    {
        _keys = keys;
    }

    [HttpGet]
    public Task<IReadOnlyList<AiApiKeyDto>> List([FromQuery] string? providerId, CancellationToken ct)
        => _keys.ListAsync(providerId, ct);

    [HttpGet("{id}")]
    public async Task<ActionResult<AiApiKeyDto>> Get(string id, CancellationToken ct)
    {
        var dto = await _keys.GetAsync(id, ct);
        return dto == null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<AiApiKeyDto>> Create([FromBody] AiApiKeyCreateDto input, CancellationToken ct)
    {
        var created = await _keys.CreateAsync(input, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public Task<AiApiKeyDto> Update(string id, [FromBody] AiApiKeyUpdateDto input, CancellationToken ct)
        => _keys.UpdateAsync(id, input, ct);

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        await _keys.DeleteAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id}/test")]
    public Task<AiApiKeyTestResult> Test(string id, [FromBody] AiApiKeyTestDto input, CancellationToken ct)
        => _keys.TestAsync(id, input, ct);
}
