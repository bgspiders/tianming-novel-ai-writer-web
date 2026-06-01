using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Core;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Core;

public class VolumeService : IVolumeService
{
    private readonly AppDbContext _db;

    public VolumeService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<VolumeDto>> ListAsync(string projectId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(projectId))
            return Array.Empty<VolumeDto>();

        var rows = await _db.Volumes
            .Where(v => v.ProjectId == projectId)
            .OrderBy(v => v.VolumeNumber)
            .ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    public async Task<VolumeDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var entity = await _db.Volumes.FindAsync(new object?[] { id }, ct);
        return entity == null ? null : ToDto(entity);
    }

    public async Task<VolumeDto> CreateAsync(VolumeUpsertDto input, CancellationToken ct = default)
    {
        await ValidateInputAsync(input, null, ct);

        var entity = new Volume
        {
            ProjectId = input.ProjectId,
            VolumeNumber = input.VolumeNumber,
            Title = input.Title.Trim(),
            Theme = BlankToNull(input.Theme),
            MilestoneText = BlankToNull(input.MilestoneText)
        };

        _db.Volumes.Add(entity);
        await TouchProjectAsync(input.ProjectId, ct);
        await _db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    public async Task<VolumeDto> UpdateAsync(string id, VolumeUpsertDto input, CancellationToken ct = default)
    {
        var entity = await _db.Volumes.FindAsync(new object?[] { id }, ct)
                     ?? throw new InvalidOperationException("分卷不存在。");

        await ValidateInputAsync(input, id, ct);

        entity.ProjectId = input.ProjectId;
        entity.VolumeNumber = input.VolumeNumber;
        entity.Title = input.Title.Trim();
        entity.Theme = BlankToNull(input.Theme);
        entity.MilestoneText = BlankToNull(input.MilestoneText);

        await TouchProjectAsync(input.ProjectId, ct);
        await _db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var entity = await _db.Volumes.FindAsync(new object?[] { id }, ct);
        if (entity == null) return;

        var chapterCount = await _db.Chapters.CountAsync(c => c.VolumeId == id, ct);
        if (chapterCount > 0)
            throw new InvalidOperationException($"分卷下已有 {chapterCount} 个章节,无法删除。");

        var projectId = entity.ProjectId;
        _db.Volumes.Remove(entity);
        await TouchProjectAsync(projectId, ct);
        await _db.SaveChangesAsync(ct);
    }

    private async Task ValidateInputAsync(VolumeUpsertDto input, string? currentId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.ProjectId))
            throw new InvalidOperationException("项目 ID 不能为空。");

        if (input.VolumeNumber <= 0)
            throw new InvalidOperationException("卷序号必须大于 0。");

        if (string.IsNullOrWhiteSpace(input.Title))
            throw new InvalidOperationException("卷标题不能为空。");

        var projectExists = await _db.Projects.AnyAsync(p => p.Id == input.ProjectId, ct);
        if (!projectExists) throw new InvalidOperationException($"项目 {input.ProjectId} 不存在。");

        var duplicated = await _db.Volumes.AnyAsync(v =>
            v.ProjectId == input.ProjectId &&
            v.VolumeNumber == input.VolumeNumber &&
            (currentId == null || v.Id != currentId), ct);
        if (duplicated) throw new InvalidOperationException($"第 {input.VolumeNumber} 卷已存在。");
    }

    private async Task TouchProjectAsync(string projectId, CancellationToken ct)
    {
        var project = await _db.Projects.FindAsync(new object?[] { projectId }, ct);
        if (project != null) project.LastModifiedAt = DateTime.UtcNow;
    }

    private static string? BlankToNull(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static VolumeDto ToDto(Volume v)
        => new(v.Id, v.ProjectId, v.VolumeNumber, v.Title, v.Theme, v.MilestoneText,
            v.CreatedAt, v.UpdatedAt);
}
