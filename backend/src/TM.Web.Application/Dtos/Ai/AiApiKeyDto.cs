namespace TM.Web.Application.Dtos.Ai;

public record AiApiKeyDto(
    string Id,
    string ProviderId,
    string Name,
    string? MaskedTail,
    bool IsEnabled,
    int RotationOrder,
    DateTime? LastUsedAt,
    DateTime CreatedAt);

public record AiApiKeyCreateDto(
    string ProviderId,
    string Name,
    string PlainKey,
    bool IsEnabled = true,
    int RotationOrder = 0);

public record AiApiKeyUpdateDto(
    string ProviderId,
    string Name,
    string? PlainKey,
    bool IsEnabled,
    int RotationOrder);

public record AiApiKeyTestDto(
    string Endpoint,
    string ModelCode,
    string Prompt);

public record AiApiKeyTestResult(
    bool Ok,
    string? Error,
    int? OutputChars,
    int? ElapsedMs);
