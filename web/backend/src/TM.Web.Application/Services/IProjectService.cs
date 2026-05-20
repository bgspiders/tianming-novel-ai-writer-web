using TM.Web.Application.Dtos.Core;

namespace TM.Web.Application.Services;

public interface IProjectService
{
    Task<IReadOnlyList<ProjectDto>> ListAsync(CancellationToken ct = default);
    Task<ProjectDto?> GetAsync(string id, CancellationToken ct = default);
    Task<ProjectDto> CreateAsync(ProjectUpsertDto input, CancellationToken ct = default);
    Task<ProjectDto> UpdateAsync(string id, ProjectUpsertDto input, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}

public interface IVolumeService
{
    Task<IReadOnlyList<VolumeDto>> ListAsync(string projectId, CancellationToken ct = default);
    Task<VolumeDto?> GetAsync(string id, CancellationToken ct = default);
    Task<VolumeDto> CreateAsync(VolumeUpsertDto input, CancellationToken ct = default);
    Task<VolumeDto> UpdateAsync(string id, VolumeUpsertDto input, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}
