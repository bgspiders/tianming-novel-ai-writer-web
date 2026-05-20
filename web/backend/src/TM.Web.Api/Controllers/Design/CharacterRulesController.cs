using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers.Design;

[ApiController]
[Route("api/design/character-rules")]
public class CharacterRulesController : ControllerBase
{
    private readonly ICharacterRuleService _svc;
    public CharacterRulesController(ICharacterRuleService svc) => _svc = svc;

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? categoryId,
        [FromQuery] string? sourceBookId,
        [FromQuery] string? keyword,
        [FromQuery] bool? isEnabled,
        [FromQuery] DateTime? updatedFrom,
        [FromQuery] DateTime? updatedTo,
        [FromQuery] int? page,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool includeUncategorized = false,
        [FromQuery] string? projectId = null,
        CancellationToken ct = default)
    {
        var query = new DesignListQuery(
            categoryId, sourceBookId, keyword, isEnabled,
            updatedFrom, updatedTo, page ?? 1, pageSize, includeUncategorized, projectId);

        if (page.HasValue)
            return Ok(await _svc.ListPagedAsync(query, ct));

        return Ok(await _svc.ListAsync(query, ct));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<CharacterRuleDto>> Get(string id, CancellationToken ct)
    {
        var dto = await _svc.GetAsync(id, ct);
        return dto == null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<CharacterRuleDto>> Create([FromBody] CharacterRuleUpsertDto input, CancellationToken ct)
    {
        var created = await _svc.CreateAsync(input, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public Task<CharacterRuleDto> Update(string id, [FromBody] CharacterRuleUpsertDto input, CancellationToken ct)
        => _svc.UpdateAsync(id, input, ct);

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        await _svc.DeleteAsync(id, ct);
        return NoContent();
    }
}
