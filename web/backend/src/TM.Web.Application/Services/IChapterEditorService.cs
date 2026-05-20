using TM.Web.Application.Dtos.Editor;

namespace TM.Web.Application.Services;

public interface IChapterEditorService
{
    Task<IReadOnlyList<ChapterListItemDto>> ListAsync(
        string? projectId,
        string? sourceBookId,
        string? keyword,
        CancellationToken ct = default);

    Task<ChapterDetailDto?> GetAsync(string id, CancellationToken ct = default);

    Task<ChapterDetailDto> UpdateContentAsync(string id, ChapterContentUpdateDto input, CancellationToken ct = default);

    Task<IReadOnlyList<ChapterVersionItemDto>> GetVersionsAsync(string id, CancellationToken ct = default);

    Task<ChapterVersionDetailDto?> GetVersionAsync(string id, string versionId, CancellationToken ct = default);

    Task<ChapterDetailDto> RestoreVersionAsync(string id, string versionId, CancellationToken ct = default);
}
