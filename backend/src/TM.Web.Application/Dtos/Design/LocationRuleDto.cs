namespace TM.Web.Application.Dtos.Design;

public record LocationRuleDto(
    string Id,
    string Name,
    string Category,
    string? CategoryId,
    bool IsEnabled,
    string? SourceBookId,
    string LocationType,
    string Description,
    string Scale,
    string Terrain,
    string Climate,
    List<string> Landmarks,
    List<string> Resources,
    string HistoricalSignificance,
    List<string> Dangers,
    string? FactionId,
    DateTime CreatedAt,
    DateTime UpdatedAt) : IBusinessDataDto;

public record LocationRuleUpsertDto(
    string Name,
    string Category = "",
    string? CategoryId = null,
    bool IsEnabled = true,
    string? SourceBookId = null,
    string? ProjectId = null,
    string LocationType = "",
    string Description = "",
    string Scale = "",
    string Terrain = "",
    string Climate = "",
    List<string>? Landmarks = null,
    List<string>? Resources = null,
    string HistoricalSignificance = "",
    List<string>? Dangers = null,
    string? FactionId = null);
