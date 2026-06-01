namespace TM.Web.Application.Dtos.Ai;

public record AiProviderConfigDto(
    string ProviderId,
    string PlatformCode,
    string ProviderCode,
    string Name,
    string? DefaultEndpoint,
    string? Notes,
    bool IsEnabled,
    int SortOrder,
    string? ModelId,
    string? ModelCode,
    string? ModelName,
    string? ApiKeyId,
    string? ApiKeyName,
    string? ApiKeyMaskedTail,
    bool HasKey,
    DateTime? KeyLastUsedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record AiProviderConfigUpsertDto(
    string PlatformCode,
    string Name,
    string? DefaultEndpoint,
    string? Notes,
    bool IsEnabled = true,
    int SortOrder = 0,
    string ModelCode = "",
    string? ModelName = null,
    string? PlainKey = null,
    string ApiKeyName = "Default");

public record AiRemoteModelDiscoveryRequestDto(
    string? ProviderId,
    string PlatformCode,
    string? Endpoint,
    string? ApiKey);

public record AiRemoteModelOptionDto(
    string Id,
    string Name,
    string? OwnedBy);

public record AiRemoteModelDiscoveryResultDto(
    string PlatformCode,
    string ResolvedEndpoint,
    IReadOnlyList<AiRemoteModelOptionDto> Models);
