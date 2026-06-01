using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/source-books")]
public class SourceBooksController : ControllerBase
{
    private readonly ISourceBookService _sourceBooks;

    public SourceBooksController(ISourceBookService sourceBooks) => _sourceBooks = sourceBooks;

    [HttpGet]
    public Task<IReadOnlyList<SourceBookDto>> List(CancellationToken ct) => _sourceBooks.ListAsync(ct);

    [HttpGet("{id}")]
    public async Task<ActionResult<SourceBookDto>> Get(string id, CancellationToken ct)
    {
        var dto = await _sourceBooks.GetAsync(id, ct);
        return dto == null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<SourceBookDto>> Create([FromBody] SourceBookUpsertDto input, CancellationToken ct)
    {
        var created = await _sourceBooks.CreateAsync(input, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public Task<SourceBookDto> Update(string id, [FromBody] SourceBookUpsertDto input, CancellationToken ct)
        => _sourceBooks.UpdateAsync(id, input, ct);

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        await _sourceBooks.DeleteAsync(id, ct);
        return NoContent();
    }
}
