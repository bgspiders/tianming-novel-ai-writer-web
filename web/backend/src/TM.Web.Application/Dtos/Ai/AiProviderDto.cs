namespace TM.Web.Application.Dtos.Ai;

public record AiProviderDto(
    string Id,
    string Code,
    string Name,
    string? DefaultEndpoint,
    string? IconUrl,
    string? Notes,
    bool IsBuiltIn,
    bool IsEnabled,
    int SortOrder,
    int ModelCount,
    int KeyCount);

public record AiProviderUpsertDto(
    string Code,
    string Name,
    string? DefaultEndpoint,
    string? IconUrl,
    string? Notes,
    bool IsEnabled = true,
    int SortOrder = 0);
