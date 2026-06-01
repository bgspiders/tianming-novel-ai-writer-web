using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/categories")]
public class CategoriesController : ControllerBase
{
    private readonly ICategoryService _categories;

    public CategoriesController(ICategoryService categories) => _categories = categories;

    /// <summary>按模块列出分类(平铺)。</summary>
    [HttpGet]
    public Task<IReadOnlyList<CategoryDto>> List(
        [FromQuery] string moduleType,
        [FromQuery] string? sourceBookId,
        [FromQuery] string? projectId,
        CancellationToken ct)
        => _categories.ListAsync(moduleType, sourceBookId, projectId, ct);

    /// <summary>按模块构建分类树。</summary>
    [HttpGet("tree")]
    public Task<IReadOnlyList<CategoryTreeNodeDto>> Tree(
        [FromQuery] string moduleType,
        [FromQuery] string? sourceBookId,
        [FromQuery] string? projectId,
        CancellationToken ct)
        => _categories.GetTreeAsync(moduleType, sourceBookId, projectId, ct);

    [HttpGet("{id}")]
    public async Task<ActionResult<CategoryDto>> Get(string id, CancellationToken ct)
    {
        var dto = await _categories.GetAsync(id, ct);
        return dto == null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<CategoryDto>> Create([FromBody] CategoryUpsertDto input, CancellationToken ct)
    {
        var created = await _categories.CreateAsync(input, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public Task<CategoryDto> Update(string id, [FromBody] CategoryUpsertDto input, CancellationToken ct)
        => _categories.UpdateAsync(id, input, ct);

    [HttpPost("reorder")]
    public async Task<IActionResult> Reorder([FromBody] CategoryReorderDto input, CancellationToken ct)
    {
        await _categories.ReorderAsync(input, ct);
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        await _categories.DeleteAsync(id, ct);
        return NoContent();
    }
}
