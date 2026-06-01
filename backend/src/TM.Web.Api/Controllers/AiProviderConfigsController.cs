using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Ai;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/ai-provider-configs")]
public sealed class AiProviderConfigsController : ControllerBase
{
    private readonly IAiProviderConfigService _configs;

    public AiProviderConfigsController(IAiProviderConfigService configs)
    {
        _configs = configs;
    }

    [HttpGet]
    public Task<IReadOnlyList<AiProviderConfigDto>> List(CancellationToken ct)
        => _configs.ListAsync(ct);

    [HttpGet("{providerId}")]
    public async Task<ActionResult<AiProviderConfigDto>> Get(string providerId, CancellationToken ct)
    {
        var dto = await _configs.GetAsync(providerId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<AiProviderConfigDto>> Create([FromBody] AiProviderConfigUpsertDto input, CancellationToken ct)
    {
        var created = await _configs.CreateAsync(input, ct);
        return CreatedAtAction(nameof(Get), new { providerId = created.ProviderId }, created);
    }

    [HttpPut("{providerId}")]
    public Task<AiProviderConfigDto> Update(string providerId, [FromBody] AiProviderConfigUpsertDto input, CancellationToken ct)
        => _configs.UpdateAsync(providerId, input, ct);

    [HttpDelete("{providerId}")]
    public async Task<IActionResult> Delete(string providerId, CancellationToken ct)
    {
        await _configs.DeleteAsync(providerId, ct);
        return NoContent();
    }

    [HttpPost("discover-models")]
    public Task<AiRemoteModelDiscoveryResultDto> DiscoverModels([FromBody] AiRemoteModelDiscoveryRequestDto input, CancellationToken ct)
        => _configs.DiscoverModelsAsync(input, ct);
}
