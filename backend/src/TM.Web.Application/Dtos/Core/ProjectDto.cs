namespace TM.Web.Application.Dtos.Core;

public record ProjectDto(
    string Id,
    string Name,
    string? Description,
    string? CurrentSourceBookId,
    int Version,
    DateTime LastModifiedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record ProjectUpsertDto(
    string Name,
    string? Description = null,
    string? CurrentSourceBookId = null);

public record VolumeDto(
    string Id,
    string ProjectId,
    int VolumeNumber,
    string Title,
    string? Theme,
    string? MilestoneText,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record VolumeUpsertDto(
    string ProjectId,
    int VolumeNumber,
    string Title,
    string? Theme = null,
    string? MilestoneText = null);
