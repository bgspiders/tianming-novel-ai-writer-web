using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Dtos.Generate;

namespace TM.Web.Application.Services;

public interface IChapterService
{
    Task<IReadOnlyList<ChapterDto>> ListAsync(string projectId, string? volumeId = null, CancellationToken ct = default);
    Task<ChapterDto?> GetAsync(string id, CancellationToken ct = default);
    Task<ChapterDto> CreateAsync(ChapterUpsertDto input, CancellationToken ct = default);
    Task<ChapterDto> UpdateAsync(string id, ChapterUpsertDto input, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
    Task<ChapterDto> SaveContentAsync(string id, string content, string status = "drafted", CancellationToken ct = default);
}

public interface IChapterDraftService
{
    Task<ChapterDraftResult> GenerateDraftAsync(ChapterDraftRequest request, CancellationToken ct = default);
}

public interface IChapterBatchGenerationService
{
    Task<ChapterBatchGenerationAcceptedDto> QueueAsync(ChapterBatchGenerationRequest request, CancellationToken ct = default);

    ChapterBatchGenerationJobStatusDto? GetStatus(string jobId);

    IReadOnlyList<ChapterBatchGenerationJobStatusDto> ListRecent(string? projectId = null, int take = 20);

    bool RequestCancel(string jobId);
}

public interface IChapterBatchGenerationJobQueue
{
    ValueTask EnqueueAsync(ChapterBatchGenerationJob job, CancellationToken ct = default);

    ValueTask<ChapterBatchGenerationJob> DequeueAsync(CancellationToken ct);
}

public sealed record ChapterBatchGenerationJob(
    string JobId,
    ChapterBatchGenerationRequest Request,
    DateTime QueuedAt);

public interface IContextPackagingService
{
    Task<PackageContextResult> PackageAsync(PackageContextRequest request, CancellationToken ct = default);
}
