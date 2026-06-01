using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/projects")]
public class ProjectsController : ControllerBase
{
    private readonly IProjectService _projects;

    public ProjectsController(IProjectService projects) => _projects = projects;

    [HttpGet]
    public Task<IReadOnlyList<ProjectDto>> List(CancellationToken ct) => _projects.ListAsync(ct);

    [HttpGet("{id}")]
    public async Task<ActionResult<ProjectDto>> Get(string id, CancellationToken ct)
    {
        var dto = await _projects.GetAsync(id, ct);
        return dto == null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<ProjectDto>> Create([FromBody] ProjectUpsertDto input, CancellationToken ct)
    {
        var created = await _projects.CreateAsync(input, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public Task<ProjectDto> Update(string id, [FromBody] ProjectUpsertDto input, CancellationToken ct)
        => _projects.UpdateAsync(id, input, ct);

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        await _projects.DeleteAsync(id, ct);
        return NoContent();
    }
}
