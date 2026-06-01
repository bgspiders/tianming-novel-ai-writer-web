using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using TM.Web.Application.Dtos.Ai;
using TM.Web.Application.Security;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.AI;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Ai;

public class AiApiKeyService : IAiApiKeyService
{
    private readonly AppDbContext _db;
    private readonly IKeyProtector _protector;
    private readonly ILogger<AiApiKeyService> _logger;

    public AiApiKeyService(AppDbContext db, IKeyProtector protector, ILogger<AiApiKeyService> logger)
    {
        _db = db;
        _protector = protector;
        _logger = logger;
    }

    public async Task<IReadOnlyList<AiApiKeyDto>> ListAsync(string? providerId, CancellationToken ct = default)
    {
        var query = _db.AiApiKeys.AsQueryable();
        if (!string.IsNullOrWhiteSpace(providerId))
            query = query.Where(k => k.ProviderId == providerId);

        var rows = await query
            .OrderBy(k => k.ProviderId)
            .ThenBy(k => k.RotationOrder)
            .ThenBy(k => k.Name)
            .ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    public async Task<AiApiKeyDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var k = await _db.AiApiKeys.FindAsync(new object?[] { id }, ct);
        return k == null ? null : ToDto(k);
    }

    public async Task<AiApiKeyDto> CreateAsync(AiApiKeyCreateDto input, CancellationToken ct = default)
    {
        if (!await _db.AiProviders.AnyAsync(p => p.Id == input.ProviderId, ct))
            throw new InvalidOperationException("Provider 不存在。");
        if (string.IsNullOrWhiteSpace(input.PlainKey))
            throw new ArgumentException("PlainKey 不能为空。");

        var (cipher, iv) = _protector.Encrypt(input.PlainKey);
        var entity = new AiApiKey
        {
            ProviderId = input.ProviderId,
            Name = input.Name,
            EncryptedKey = cipher,
            Iv = iv,
            MaskedTail = _protector.ComputeMaskedTail(input.PlainKey),
            IsEnabled = input.IsEnabled,
            RotationOrder = input.RotationOrder,
        };
        _db.AiApiKeys.Add(entity);
        await _db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    public async Task<AiApiKeyDto> UpdateAsync(string id, AiApiKeyUpdateDto input, CancellationToken ct = default)
    {
        var entity = await _db.AiApiKeys.FindAsync(new object?[] { id }, ct)
                     ?? throw new InvalidOperationException("Key 不存在。");

        if (!await _db.AiProviders.AnyAsync(p => p.Id == input.ProviderId, ct))
            throw new InvalidOperationException("Provider 不存在。");

        entity.ProviderId = input.ProviderId;
        entity.Name = input.Name;
        entity.IsEnabled = input.IsEnabled;
        entity.RotationOrder = input.RotationOrder;

        if (!string.IsNullOrWhiteSpace(input.PlainKey))
        {
            var (cipher, iv) = _protector.Encrypt(input.PlainKey);
            entity.EncryptedKey = cipher;
            entity.Iv = iv;
            entity.MaskedTail = _protector.ComputeMaskedTail(input.PlainKey);
        }

        await _db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var entity = await _db.AiApiKeys.FindAsync(new object?[] { id }, ct);
        if (entity == null) return;
        _db.AiApiKeys.Remove(entity);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<AiApiKeyTestResult> TestAsync(string id, AiApiKeyTestDto input, CancellationToken ct = default)
    {
        var entity = await _db.AiApiKeys.FindAsync(new object?[] { id }, ct)
                     ?? throw new InvalidOperationException("Key 不存在。");

        var plainKey = _protector.Decrypt(entity.EncryptedKey, entity.Iv);
        var sw = Stopwatch.StartNew();
        try
        {
            var kernel = Kernel.CreateBuilder()
                .AddOpenAIChatCompletion(
                    modelId: input.ModelCode,
                    endpoint: new Uri(NormalizeEndpoint(input.Endpoint)),
                    apiKey: plainKey)
                .Build();

            var chat = kernel.GetRequiredService<IChatCompletionService>();
            var history = new ChatHistory();
            history.AddUserMessage(input.Prompt);
            var settings = new OpenAIPromptExecutionSettings
            {
                Temperature = 0.3,
                MaxTokens = 64,
            };

            var reply = await chat.GetChatMessageContentAsync(history, settings, kernel, ct);
            sw.Stop();

            entity.LastUsedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            return new AiApiKeyTestResult(
                Ok: true,
                Error: null,
                OutputChars: reply?.Content?.Length ?? 0,
                ElapsedMs: (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogWarning(ex, "ApiKey 测试失败：key={KeyId} endpoint={Endpoint} model={Model}",
                id, input.Endpoint, input.ModelCode);
            return new AiApiKeyTestResult(
                Ok: false,
                Error: ex.Message,
                OutputChars: null,
                ElapsedMs: (int)sw.ElapsedMilliseconds);
        }
    }

    public async Task<string?> GetPlainKeyAsync(string id, CancellationToken ct = default)
    {
        var entity = await _db.AiApiKeys.FindAsync(new object?[] { id }, ct);
        if (entity == null) return null;
        if (!entity.IsEnabled)
            throw new InvalidOperationException("Key 已禁用。");

        entity.LastUsedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return _protector.Decrypt(entity.EncryptedKey, entity.Iv);
    }

    public async Task<string?> RotateNextPlainKeyAsync(string providerId, CancellationToken ct = default)
    {
        var entity = await _db.AiApiKeys
            .Where(k => k.ProviderId == providerId && k.IsEnabled)
            .OrderBy(k => k.LastUsedAt ?? DateTime.MinValue)
            .ThenBy(k => k.RotationOrder)
            .FirstOrDefaultAsync(ct);

        if (entity == null) return null;
        entity.LastUsedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return _protector.Decrypt(entity.EncryptedKey, entity.Iv);
    }

    private static AiApiKeyDto ToDto(AiApiKey k)
        => new(k.Id, k.ProviderId, k.Name, k.MaskedTail, k.IsEnabled, k.RotationOrder, k.LastUsedAt, k.CreatedAt);

    private static string NormalizeEndpoint(string endpoint)
    {
        var trimmed = endpoint.Trim().TrimEnd('/');
        var lower = trimmed.ToLowerInvariant();
        if (lower.EndsWith("/v1") || lower.Contains("/v1/") || lower.EndsWith("/openai"))
            return trimmed;
        return trimmed + "/v1";
    }
}
