using TM.Web.Application.Dtos.Recall;

namespace TM.Web.Application.Services;

public interface IChapterRecallService
{
    Task<ChapterRecallResponseDto?> RecallAsync(
        string chapterId,
        string? query,
        int topK,
        CancellationToken ct = default);
}
