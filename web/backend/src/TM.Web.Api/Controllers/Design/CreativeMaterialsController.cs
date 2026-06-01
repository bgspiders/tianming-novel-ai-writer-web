using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers.Design;

[ApiController]
[Route("api/design/creative-materials")]
public class CreativeMaterialsController : ControllerBase
{
    private readonly ICreativeMaterialService _svc;
    public CreativeMaterialsController(ICreativeMaterialService svc) => _svc = svc;

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
    public async Task<ActionResult<CreativeMaterialDto>> Get(string id, CancellationToken ct)
    {
        var dto = await _svc.GetAsync(id, ct);
        return dto == null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<CreativeMaterialDto>> Create([FromBody] CreativeMaterialUpsertDto input, CancellationToken ct)
    {
        var created = await _svc.CreateAsync(input, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPost("from-book-analysis/{bookAnalysisId}")]
    public async Task<ActionResult<CreativeMaterialDto>> CreateFromBookAnalysis(string bookAnalysisId, CancellationToken ct)
    {
        var created = await _svc.CreateFromBookAnalysisAsync(bookAnalysisId, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPost("{id}/build-skeleton")]
    public Task<SkeletonBuildResultDto> BuildSkeleton(string id, CancellationToken ct)
        => _svc.BuildSkeletonAsync(id, ct);

    [HttpPut("{id}")]
    public Task<CreativeMaterialDto> Update(string id, [FromBody] CreativeMaterialUpsertDto input, CancellationToken ct)
        => _svc.UpdateAsync(id, input, ct);

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        await _svc.DeleteAsync(id, ct);
        return NoContent();
    }
}
