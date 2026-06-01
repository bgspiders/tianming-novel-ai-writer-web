using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Dtos.Editor;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/editor")]
public sealed class EditorController : ControllerBase
{
    private readonly IEditorService _editor;

    public EditorController(IEditorService editor)
    {
        _editor = editor;
    }

    [HttpPost("search")]
    public Task<IReadOnlyList<EditorSearchResultDto>> Search([FromBody] EditorSearchRequest request, CancellationToken ct)
        => _editor.SearchAsync(request, ct);

    [HttpGet("chapters/{chapterId}")]
    public async Task<ActionResult<EditorChapterAssistDto>> GetChapterAssist(
        string chapterId,
        [FromQuery] int relatedTopK,
        CancellationToken ct)
    {
        var result = await _editor.GetChapterAssistAsync(chapterId, relatedTopK <= 0 ? 6 : relatedTopK, ct);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPut("chapters/{chapterId}/content")]
    public Task<ChapterDto> SaveChapterContent(
        string chapterId,
        [FromBody] EditorSaveChapterRequest request,
        CancellationToken ct)
        => _editor.SaveChapterContentAsync(chapterId, request, ct);

    [HttpPost("index/rebuild")]
    public Task<EditorIndexRebuildResultDto> RebuildIndex(
        [FromBody] EditorIndexRebuildRequest request,
        CancellationToken ct)
        => _editor.RebuildIndexAsync(request.ProjectId, ct);

    [HttpGet("index/status")]
    public Task<EditorIndexStatusDto> GetIndexStatus(
        [FromQuery] string projectId,
        CancellationToken ct)
        => _editor.GetIndexStatusAsync(projectId, ct);
}
