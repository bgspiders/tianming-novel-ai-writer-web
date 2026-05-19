using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Ai;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/ai-providers")]
public class AiProvidersController : ControllerBase
{
    private readonly IAiProviderService _providers;
    private readonly IAiModelService _models;

    public AiProvidersController(IAiProviderService providers, IAiModelService models)
    {
        _providers = providers;
        _models = models;
    }

    [HttpGet]
    public Task<IReadOnlyList<AiProviderDto>> List(CancellationToken ct) => _providers.ListAsync(ct);

    [HttpGet("{id}")]
    public async Task<ActionResult<AiProviderDto>> Get(string id, CancellationToken ct)
    {
        var dto = await _providers.GetAsync(id, ct);
        return dto == null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<AiProviderDto>> Create([FromBody] AiProviderUpsertDto input, CancellationToken ct)
    {
        var created = await _providers.CreateAsync(input, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public Task<AiProviderDto> Update(string id, [FromBody] AiProviderUpsertDto input, CancellationToken ct)
        => _providers.UpdateAsync(id, input, ct);

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        await _providers.DeleteAsync(id, ct);
        return NoContent();
    }

    // 嵌套模型路由
    [HttpGet("{providerId}/models")]
    public Task<IReadOnlyList<AiModelDto>> ListModels(string providerId, CancellationToken ct)
        => _models.ListAsync(providerId, ct);

    [HttpPost("{providerId}/models")]
    public async Task<ActionResult<AiModelDto>> CreateModel(string providerId, [FromBody] AiModelUpsertDto input, CancellationToken ct)
    {
        var created = await _models.CreateAsync(providerId, input, ct);
        return CreatedAtAction(nameof(GetModel), new { providerId, modelId = created.Id }, created);
    }

    [HttpGet("{providerId}/models/{modelId}")]
    public async Task<ActionResult<AiModelDto>> GetModel(string providerId, string modelId, CancellationToken ct)
    {
        var dto = await _models.GetAsync(modelId, ct);
        if (dto == null || dto.ProviderId != providerId) return NotFound();
        return Ok(dto);
    }

    [HttpPut("{providerId}/models/{modelId}")]
    public Task<AiModelDto> UpdateModel(string providerId, string modelId, [FromBody] AiModelUpsertDto input, CancellationToken ct)
        => _models.UpdateAsync(modelId, input, ct);

    [HttpDelete("{providerId}/models/{modelId}")]
    public async Task<IActionResult> DeleteModel(string providerId, string modelId, CancellationToken ct)
    {
        await _models.DeleteAsync(modelId, ct);
        return NoContent();
    }
}
