using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Core;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Core;

public class ProjectService : IProjectService
{
    private readonly AppDbContext _db;

    public ProjectService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<ProjectDto>> ListAsync(CancellationToken ct = default)
    {
        var rows = await _db.Projects
            .OrderByDescending(p => p.LastModifiedAt)
            .ThenByDescending(p => p.UpdatedAt)
            .ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    public async Task<ProjectDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var entity = await _db.Projects.FindAsync(new object?[] { id }, ct);
        return entity == null ? null : ToDto(entity);
    }

    public async Task<ProjectDto> CreateAsync(ProjectUpsertDto input, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(input.Name))
            throw new InvalidOperationException("项目名称不能为空。");

        var name = input.Name.Trim();
        var exists = await _db.Projects.AnyAsync(p => p.Name == name, ct);
        if (exists) throw new InvalidOperationException($"项目 {name} 已存在。");

        await ValidateSourceBookAsync(input.CurrentSourceBookId, ct);

        var entity = new Project
        {
            Name = name,
            Description = BlankToNull(input.Description),
            CurrentSourceBookId = BlankToNull(input.CurrentSourceBookId),
            LastModifiedAt = DateTime.UtcNow
        };

        _db.Projects.Add(entity);
        await _db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    public async Task<ProjectDto> UpdateAsync(string id, ProjectUpsertDto input, CancellationToken ct = default)
    {
        var entity = await _db.Projects.FindAsync(new object?[] { id }, ct)
                     ?? throw new InvalidOperationException("项目不存在。");

        if (string.IsNullOrWhiteSpace(input.Name))
            throw new InvalidOperationException("项目名称不能为空。");

        var name = input.Name.Trim();
        var duplicated = await _db.Projects.AnyAsync(p => p.Id != id && p.Name == name, ct);
        if (duplicated) throw new InvalidOperationException($"项目 {name} 已存在。");

        await ValidateSourceBookAsync(input.CurrentSourceBookId, ct);

        entity.Name = name;
        entity.Description = BlankToNull(input.Description);
        entity.CurrentSourceBookId = BlankToNull(input.CurrentSourceBookId);
        entity.LastModifiedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var exists = await _db.Projects.AnyAsync(p => p.Id == id, ct);
        if (!exists) return;

        await DeleteProjectScopedDataAsync(id, ct);
        await _db.Projects.Where(p => p.Id == id).ExecuteDeleteAsync(ct);
    }

    private async Task DeleteProjectScopedDataAsync(string projectId, CancellationToken ct)
    {
        await _db.ValidationReports.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);
        await _db.ValidationSummaries.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);

        await _db.GenerationRecords.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);
        await _db.GenerationStatistics.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);
        await _db.ChatSessions.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);

        await _db.KeywordChapterIndices.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);
        await _db.RelationStrengthIndices.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);
        await _db.GlobalSummaryCaches.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);
        await _db.LayerCompletionStatuses.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);

        await _db.Manifests.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);
        await _db.WorkScopes.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);

        await _db.CharacterStateEntries.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);
        await _db.FactionStateEntries.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);
        await _db.LocationStateEntries.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);
        await _db.ItemStateEntries.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);
        await _db.ConflictProgressEntries.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);
        await _db.ChapterTimelines.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);
        await _db.CharacterLocations.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);
        await _db.CharacterMovements.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);
        await _db.Foreshadowings.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);
        await _db.PlotPoints.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);
        await _db.VolumeFactArchives.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);

        await _db.Chapters.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);
        await _db.Volumes.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync(ct);
    }

    private async Task ValidateSourceBookAsync(string? sourceBookId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(sourceBookId)) return;
        var exists = await _db.SourceBooks.AnyAsync(s => s.Id == sourceBookId, ct);
        if (!exists) throw new InvalidOperationException($"源书 {sourceBookId} 不存在。");
    }

    private static string? BlankToNull(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static ProjectDto ToDto(Project p)
        => new(p.Id, p.Name, p.Description, p.CurrentSourceBookId, p.Version,
            p.LastModifiedAt, p.CreatedAt, p.UpdatedAt);
}
