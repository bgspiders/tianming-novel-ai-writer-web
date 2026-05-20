namespace TM.Web.Application.Dtos.Design;

public record WorldRuleDto(
    string Id,
    string Name,
    string Category,
    string? CategoryId,
    bool IsEnabled,
    string? SourceBookId,
    string OneLineSummary,
    string PowerSystem,
    string Cosmology,
    string SpecialLaws,
    string HardRules,
    string SoftRules,
    string AncientEra,
    string KeyEvents,
    string ModernHistory,
    string StatusQuo,
    DateTime CreatedAt,
    DateTime UpdatedAt) : IBusinessDataDto;

public record WorldRuleUpsertDto(
    string Name,
    string Category = "",
    string? CategoryId = null,
    bool IsEnabled = true,
    string? SourceBookId = null,
    string? ProjectId = null,
    string OneLineSummary = "",
    string PowerSystem = "",
    string Cosmology = "",
    string SpecialLaws = "",
    string HardRules = "",
    string SoftRules = "",
    string AncientEra = "",
    string KeyEvents = "",
    string ModernHistory = "",
    string StatusQuo = "");
