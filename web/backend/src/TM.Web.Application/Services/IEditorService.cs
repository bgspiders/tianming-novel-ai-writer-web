using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Dtos.Editor;

namespace TM.Web.Application.Services;

public interface IEditorService
{
    Task<IReadOnlyList<EditorSearchResultDto>> SearchAsync(EditorSearchRequest request, CancellationToken ct = default);
    Task<EditorChapterAssistDto?> GetChapterAssistAsync(string chapterId, int relatedTopK = 6, CancellationToken ct = default);
    Task<ChapterDto> SaveChapterContentAsync(string chapterId, EditorSaveChapterRequest request, CancellationToken ct = default);
    Task<EditorIndexRebuildResultDto> RebuildIndexAsync(string projectId, CancellationToken ct = default);
    Task<EditorIndexStatusDto> GetIndexStatusAsync(string projectId, CancellationToken ct = default);
}
