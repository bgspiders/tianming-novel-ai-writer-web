namespace TM.Web.Application.Dtos.Ai;

public record AiModelDto(
    string Id,
    string ProviderId,
    string Code,
    string Name,
    string? Description,
    int? ContextWindow,
    int? MaxOutputTokens,
    string Capabilities,
    decimal? InputPricePerMillion,
    decimal? OutputPricePerMillion,
    bool IsEnabled,
    int SortOrder);

public record AiModelUpsertDto(
    string Code,
    string Name,
    string? Description = null,
    int? ContextWindow = null,
    int? MaxOutputTokens = null,
    string Capabilities = "{}",
    decimal? InputPricePerMillion = null,
    decimal? OutputPricePerMillion = null,
    bool IsEnabled = true,
    int SortOrder = 0);
