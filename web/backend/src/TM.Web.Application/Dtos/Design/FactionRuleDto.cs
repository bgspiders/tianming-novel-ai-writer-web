namespace TM.Web.Application.Dtos.Design;

public record FactionRuleDto(
    string Id,
    string Name,
    string Category,
    string? CategoryId,
    bool IsEnabled,
    string? SourceBookId,
    string FactionType,
    string Goal,
    string StrengthTerritory,
    string Leader,
    string CoreMembers,
    string MemberTraits,
    string Allies,
    string Enemies,
    string NeutralCompetitors,
    DateTime CreatedAt,
    DateTime UpdatedAt) : IBusinessDataDto;

public record FactionRuleUpsertDto(
    string Name,
    string Category = "",
    string? CategoryId = null,
    bool IsEnabled = true,
    string? SourceBookId = null,
    string FactionType = "",
    string Goal = "",
    string StrengthTerritory = "",
    string Leader = "",
    string CoreMembers = "",
    string MemberTraits = "",
    string Allies = "",
    string Enemies = "",
    string NeutralCompetitors = "");
