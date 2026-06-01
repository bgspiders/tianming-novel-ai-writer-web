using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Ai;
using TM.Web.Application.Security;
using TM.Web.Application.Services;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Ai;

public sealed class AiProviderConfigService : IAiProviderConfigService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly IReadOnlyDictionary<string, (string Name, string Endpoint)> BuiltInPlatforms =
        new Dictionary<string, (string Name, string Endpoint)>(StringComparer.OrdinalIgnoreCase)
        {
            ["openai"] = ("OpenAI", "https://api.openai.com/v1"),
            ["anthropic"] = ("Anthropic", "https://api.anthropic.com/v1"),
            ["gemini"] = ("Google Gemini", "https://generativelanguage.googleapis.com/v1beta/openai"),
            ["deepseek"] = ("DeepSeek", "https://api.deepseek.com/v1"),
            ["moonshot"] = ("Moonshot", "https://api.moonshot.cn/v1"),
            ["custom"] = ("自定义 OpenAI 兼容平台", "https://api.openai.com/v1")
        };

    private readonly AppDbContext _db;
    private readonly IAiHttpClientFactory _httpClientFactory;
    private readonly IKeyProtector _keyProtector;

    private sealed record ProviderConfigRow(
        TM.Web.Domain.Entities.AI.AiProvider Provider,
        TM.Web.Domain.Entities.AI.AiModel? Model,
        TM.Web.Domain.Entities.AI.AiApiKey? Key);

    public AiProviderConfigService(
        AppDbContext db,
        IAiHttpClientFactory httpClientFactory,
        IKeyProtector keyProtector)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
        _keyProtector = keyProtector;
    }

    public async Task<IReadOnlyList<AiProviderConfigDto>> ListAsync(CancellationToken ct = default)
    {
        var providers = await _db.AiProviders
            .Where(p => !p.IsBuiltIn)
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.Name)
            .Select(p => new ProviderConfigRow(
                p,
                _db.AiModels.Where(m => m.ProviderId == p.Id).OrderBy(m => m.SortOrder).ThenBy(m => m.Name).FirstOrDefault(),
                _db.AiApiKeys.Where(k => k.ProviderId == p.Id).OrderBy(k => k.RotationOrder).ThenBy(k => k.Name).FirstOrDefault()))
            .ToListAsync(ct);

        return providers.Select(Map).ToList();
    }

    public async Task<AiProviderConfigDto?> GetAsync(string providerId, CancellationToken ct = default)
    {
        var row = await _db.AiProviders
            .Where(p => p.Id == providerId && !p.IsBuiltIn)
            .Select(p => new ProviderConfigRow(
                p,
                _db.AiModels.Where(m => m.ProviderId == p.Id).OrderBy(m => m.SortOrder).ThenBy(m => m.Name).FirstOrDefault(),
                _db.AiApiKeys.Where(k => k.ProviderId == p.Id).OrderBy(k => k.RotationOrder).ThenBy(k => k.Name).FirstOrDefault()))
            .FirstOrDefaultAsync(ct);

        return row is null ? null : Map(row);
    }

    public async Task<AiProviderConfigDto> CreateAsync(AiProviderConfigUpsertDto input, CancellationToken ct = default)
    {
        ValidateInput(input);

        var provider = new TM.Web.Domain.Entities.AI.AiProvider
        {
            Code = await BuildProviderCodeAsync(input, ct),
            Name = input.Name.Trim(),
            DefaultEndpoint = NormalizeEndpoint(input.EndpointOrDefault()),
            Notes = ComposeNotes(input.PlatformCode, input.Notes),
            IsBuiltIn = false,
            IsEnabled = input.IsEnabled,
            SortOrder = input.SortOrder
        };
        _db.AiProviders.Add(provider);

        var model = new TM.Web.Domain.Entities.AI.AiModel
        {
            ProviderId = provider.Id,
            Code = input.ModelCode.Trim(),
            Name = string.IsNullOrWhiteSpace(input.ModelName) ? input.ModelCode.Trim() : input.ModelName.Trim(),
            Description = "由 /v1/models 自动发现",
            Capabilities = "{\"streaming\":true}",
            IsEnabled = input.IsEnabled,
            SortOrder = 0
        };
        _db.AiModels.Add(model);

        if (!string.IsNullOrWhiteSpace(input.PlainKey))
        {
            var (cipher, iv) = _keyProtector.Encrypt(input.PlainKey.Trim());
            _db.AiApiKeys.Add(new TM.Web.Domain.Entities.AI.AiApiKey
            {
                ProviderId = provider.Id,
                Name = string.IsNullOrWhiteSpace(input.ApiKeyName) ? "Default" : input.ApiKeyName.Trim(),
                EncryptedKey = cipher,
                Iv = iv,
                MaskedTail = _keyProtector.ComputeMaskedTail(input.PlainKey.Trim()),
                IsEnabled = input.IsEnabled,
                RotationOrder = 0
            });
        }

        await _db.SaveChangesAsync(ct);
        return (await GetAsync(provider.Id, ct))!;
    }

    public async Task<AiProviderConfigDto> UpdateAsync(string providerId, AiProviderConfigUpsertDto input, CancellationToken ct = default)
    {
        ValidateInput(input);

        var provider = await _db.AiProviders.FirstOrDefaultAsync(p => p.Id == providerId && !p.IsBuiltIn, ct)
            ?? throw new InvalidOperationException("配置不存在。");
        var model = await _db.AiModels.Where(m => m.ProviderId == providerId).OrderBy(m => m.SortOrder).ThenBy(m => m.Name).FirstOrDefaultAsync(ct);
        var key = await _db.AiApiKeys.Where(k => k.ProviderId == providerId).OrderBy(k => k.RotationOrder).ThenBy(k => k.Name).FirstOrDefaultAsync(ct);

        provider.Name = input.Name.Trim();
        provider.DefaultEndpoint = NormalizeEndpoint(input.EndpointOrDefault());
        provider.Notes = ComposeNotes(input.PlatformCode, input.Notes);
        provider.IsEnabled = input.IsEnabled;
        provider.SortOrder = input.SortOrder;

        if (model is null)
        {
            model = new TM.Web.Domain.Entities.AI.AiModel
            {
                ProviderId = provider.Id,
                SortOrder = 0
            };
            _db.AiModels.Add(model);
        }

        model.Code = input.ModelCode.Trim();
        model.Name = string.IsNullOrWhiteSpace(input.ModelName) ? input.ModelCode.Trim() : input.ModelName.Trim();
        model.Description = "由 /v1/models 自动发现";
        model.Capabilities = "{\"streaming\":true}";
        model.IsEnabled = input.IsEnabled;

        if (!string.IsNullOrWhiteSpace(input.PlainKey))
        {
            var (cipher, iv) = _keyProtector.Encrypt(input.PlainKey.Trim());
            if (key is null)
            {
                key = new TM.Web.Domain.Entities.AI.AiApiKey
                {
                    ProviderId = provider.Id,
                    RotationOrder = 0
                };
                _db.AiApiKeys.Add(key);
            }

            key.Name = string.IsNullOrWhiteSpace(input.ApiKeyName) ? "Default" : input.ApiKeyName.Trim();
            key.EncryptedKey = cipher;
            key.Iv = iv;
            key.MaskedTail = _keyProtector.ComputeMaskedTail(input.PlainKey.Trim());
            key.IsEnabled = input.IsEnabled;
        }
        else if (key is not null)
        {
            key.Name = string.IsNullOrWhiteSpace(input.ApiKeyName) ? key.Name : input.ApiKeyName.Trim();
            key.IsEnabled = input.IsEnabled;
        }

        await _db.SaveChangesAsync(ct);
        return (await GetAsync(provider.Id, ct))!;
    }

    public async Task DeleteAsync(string providerId, CancellationToken ct = default)
    {
        var provider = await _db.AiProviders.FirstOrDefaultAsync(p => p.Id == providerId && !p.IsBuiltIn, ct);
        if (provider is null) return;
        _db.AiProviders.Remove(provider);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<AiRemoteModelDiscoveryResultDto> DiscoverModelsAsync(AiRemoteModelDiscoveryRequestDto input, CancellationToken ct = default)
    {
        var endpoint = NormalizeEndpoint(string.IsNullOrWhiteSpace(input.Endpoint)
            ? GetPlatformEndpoint(input.PlatformCode)
            : input.Endpoint!);
        var apiKey = input.ApiKey?.Trim();
        if (string.IsNullOrWhiteSpace(apiKey) && !string.IsNullOrWhiteSpace(input.ProviderId))
        {
            var entity = await _db.AiApiKeys
                .Where(k => k.ProviderId == input.ProviderId && k.IsEnabled)
                .OrderBy(k => k.RotationOrder)
                .ThenBy(k => k.Name)
                .FirstOrDefaultAsync(ct);
            if (entity is not null)
            {
                apiKey = _keyProtector.Decrypt(entity.EncryptedKey, entity.Iv);
            }
        }

        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("API Key 不能为空。");

        using var request = new HttpRequestMessage(HttpMethod.Get, $"{endpoint.TrimEnd('/')}/models");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        var client = _httpClientFactory.CreateOpenAiCompatibleClient();
        using var response = await client.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"拉取模型失败：HTTP {(int)response.StatusCode} {response.ReasonPhrase} | {TrimBody(body)}");

        var payload = JsonSerializer.Deserialize<OpenAiModelsResponse>(body, JsonOptions)
            ?? throw new InvalidOperationException("模型列表响应为空。");

        var models = payload.Data?
            .Where(x => !string.IsNullOrWhiteSpace(x.Id))
            .Select(x => new AiRemoteModelOptionDto(x.Id!, x.Id!, x.OwnedBy))
            .DistinctBy(x => x.Id)
            .OrderBy(x => x.Id, StringComparer.OrdinalIgnoreCase)
            .ToList() ?? new List<AiRemoteModelOptionDto>();

        return new AiRemoteModelDiscoveryResultDto(input.PlatformCode, endpoint, models);
    }

    private static AiProviderConfigDto Map(ProviderConfigRow row)
    {
        var provider = row.Provider;
        var model = row.Model;
        var key = row.Key;
        var (platformCode, cleanNotes) = ParsePlatformMeta(provider.Notes);
        return new AiProviderConfigDto(
            provider.Id,
            platformCode,
            provider.Code,
            provider.Name,
            provider.DefaultEndpoint,
            cleanNotes,
            provider.IsEnabled,
            provider.SortOrder,
            model?.Id,
            model?.Code,
            model?.Name,
            key?.Id,
            key?.Name,
            key?.MaskedTail,
            key is not null,
            key?.LastUsedAt,
            provider.CreatedAt,
            provider.UpdatedAt);
    }

    private async Task<string> BuildProviderCodeAsync(AiProviderConfigUpsertDto input, CancellationToken ct)
    {
        var prefix = string.IsNullOrWhiteSpace(input.PlatformCode) ? "platform" : input.PlatformCode.Trim().ToLowerInvariant();
        for (var i = 1; i < 10000; i++)
        {
            var code = $"{prefix}_{i:D3}";
            if (!await _db.AiProviders.AnyAsync(p => p.Code == code, ct))
                return code;
        }

        throw new InvalidOperationException("无法生成唯一 Provider 编码。");
    }

    private static void ValidateInput(AiProviderConfigUpsertDto input)
    {
        if (string.IsNullOrWhiteSpace(input.PlatformCode))
            throw new InvalidOperationException("平台不能为空。");
        if (string.IsNullOrWhiteSpace(input.Name))
            throw new InvalidOperationException("名称不能为空。");
        if (string.IsNullOrWhiteSpace(input.ModelCode))
            throw new InvalidOperationException("模型不能为空。");
    }

    private static string GetPlatformEndpoint(string platformCode)
    {
        if (BuiltInPlatforms.TryGetValue(platformCode, out var platform))
            return platform.Endpoint;
        return BuiltInPlatforms["custom"].Endpoint;
    }

    private static string NormalizeEndpoint(string endpoint)
    {
        var trimmed = endpoint.Trim().TrimEnd('/');
        var lower = trimmed.ToLowerInvariant();
        if (lower.EndsWith("/v1") || lower.Contains("/v1/") || lower.EndsWith("/openai") || lower.EndsWith("/v1beta/openai"))
            return trimmed;
        return trimmed + "/v1";
    }

    private static string ComposeNotes(string platformCode, string? notes)
    {
        var trimmed = notes?.Trim();
        return string.IsNullOrWhiteSpace(trimmed)
            ? $"platform:{platformCode}"
            : $"platform:{platformCode}\n{trimmed}";
    }

    private static (string PlatformCode, string? Notes) ParsePlatformMeta(string? notes)
    {
        if (string.IsNullOrWhiteSpace(notes))
            return ("custom", null);

        var lines = notes.Split('\n', 2);
        if (lines[0].StartsWith("platform:", StringComparison.OrdinalIgnoreCase))
        {
            var code = lines[0]["platform:".Length..].Trim();
            var rest = lines.Length > 1 ? lines[1].Trim() : null;
            return (string.IsNullOrWhiteSpace(code) ? "custom" : code, string.IsNullOrWhiteSpace(rest) ? null : rest);
        }

        return ("custom", notes.Trim());
    }

    private static string TrimBody(string? body)
    {
        if (string.IsNullOrWhiteSpace(body))
            return "empty response";
        var trimmed = body.Trim();
        return trimmed.Length <= 240 ? trimmed : $"{trimmed[..237]}...";
    }

    private sealed record OpenAiModelsResponse(List<OpenAiModelItem>? Data);
    private sealed record OpenAiModelItem(string? Id, string? OwnedBy);
}

file static class AiProviderConfigExtensions
{
    public static string EndpointOrDefault(this AiProviderConfigUpsertDto input)
        => string.IsNullOrWhiteSpace(input.DefaultEndpoint)
            ? AiProviderConfigDefaults.ResolveEndpoint(input.PlatformCode)
            : input.DefaultEndpoint!;
}

file static class AiProviderConfigDefaults
{
    public static string ResolveEndpoint(string platformCode) => platformCode.Trim().ToLowerInvariant() switch
    {
        "openai" => "https://api.openai.com/v1",
        "anthropic" => "https://api.anthropic.com/v1",
        "gemini" => "https://generativelanguage.googleapis.com/v1beta/openai",
        "deepseek" => "https://api.deepseek.com/v1",
        "moonshot" => "https://api.moonshot.cn/v1",
        _ => "https://api.openai.com/v1"
    };
}
