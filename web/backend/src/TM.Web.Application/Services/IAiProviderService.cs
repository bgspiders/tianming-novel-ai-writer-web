using TM.Web.Application.Dtos.Ai;

namespace TM.Web.Application.Services;

public interface IAiProviderService
{
    Task<IReadOnlyList<AiProviderDto>> ListAsync(CancellationToken ct = default);
    Task<AiProviderDto?> GetAsync(string id, CancellationToken ct = default);
    Task<AiProviderDto> CreateAsync(AiProviderUpsertDto input, CancellationToken ct = default);
    Task<AiProviderDto> UpdateAsync(string id, AiProviderUpsertDto input, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}

public interface IAiModelService
{
    Task<IReadOnlyList<AiModelDto>> ListAsync(string providerId, CancellationToken ct = default);
    Task<AiModelDto?> GetAsync(string id, CancellationToken ct = default);
    Task<AiModelDto> CreateAsync(string providerId, AiModelUpsertDto input, CancellationToken ct = default);
    Task<AiModelDto> UpdateAsync(string id, AiModelUpsertDto input, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}

public interface IAiApiKeyService
{
    Task<IReadOnlyList<AiApiKeyDto>> ListAsync(string? providerId, CancellationToken ct = default);
    Task<AiApiKeyDto?> GetAsync(string id, CancellationToken ct = default);
    Task<AiApiKeyDto> CreateAsync(AiApiKeyCreateDto input, CancellationToken ct = default);
    Task<AiApiKeyDto> UpdateAsync(string id, AiApiKeyUpdateDto input, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);

    /// <summary>用指定 Key 真实调用 AI 端点验证连通性。明文 Key 解密后传给 IAiCompletionService。</summary>
    Task<AiApiKeyTestResult> TestAsync(string id, AiApiKeyTestDto input, CancellationToken ct = default);

    /// <summary>按 RotationOrder 取下一个可用 Key 的明文，并更新 LastUsedAt（用于阶段 4+ 章节生成流程）。</summary>
    Task<string?> RotateNextPlainKeyAsync(string providerId, CancellationToken ct = default);
}
