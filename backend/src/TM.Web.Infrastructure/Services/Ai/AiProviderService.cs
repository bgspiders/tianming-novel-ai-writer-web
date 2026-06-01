using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Ai;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.AI;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Ai;

public class AiProviderService : IAiProviderService
{
    private readonly AppDbContext _db;

    public AiProviderService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<AiProviderDto>> ListAsync(CancellationToken ct = default)
    {
        var rows = await _db.AiProviders
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.Name)
            .Select(p => new
            {
                Provider = p,
                ModelCount = _db.AiModels.Count(m => m.ProviderId == p.Id),
                KeyCount = _db.AiApiKeys.Count(k => k.ProviderId == p.Id),
            })
            .ToListAsync(ct);

        return rows.Select(r => ToDto(r.Provider, r.ModelCount, r.KeyCount)).ToList();
    }

    public async Task<AiProviderDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var p = await _db.AiProviders.FindAsync(new object?[] { id }, ct);
        if (p == null) return null;
        var modelCount = await _db.AiModels.CountAsync(m => m.ProviderId == id, ct);
        var keyCount = await _db.AiApiKeys.CountAsync(k => k.ProviderId == id, ct);
        return ToDto(p, modelCount, keyCount);
    }

    public async Task<AiProviderDto> CreateAsync(AiProviderUpsertDto input, CancellationToken ct = default)
    {
        if (await _db.AiProviders.AnyAsync(p => p.Code == input.Code, ct))
            throw new InvalidOperationException($"Provider 编码 '{input.Code}' 已存在。");

        var entity = new AiProvider
        {
            Code = input.Code,
            Name = input.Name,
            DefaultEndpoint = input.DefaultEndpoint,
            IconUrl = input.IconUrl,
            Notes = input.Notes,
            IsEnabled = input.IsEnabled,
            SortOrder = input.SortOrder,
            IsBuiltIn = false,
        };
        _db.AiProviders.Add(entity);
        await _db.SaveChangesAsync(ct);
        return ToDto(entity, 0, 0);
    }

    public async Task<AiProviderDto> UpdateAsync(string id, AiProviderUpsertDto input, CancellationToken ct = default)
    {
        var entity = await _db.AiProviders.FindAsync(new object?[] { id }, ct)
                     ?? throw new InvalidOperationException("Provider 不存在。");

        if (entity.Code != input.Code &&
            await _db.AiProviders.AnyAsync(p => p.Code == input.Code && p.Id != id, ct))
        {
            throw new InvalidOperationException($"Provider 编码 '{input.Code}' 已被占用。");
        }

        entity.Code = input.Code;
        entity.Name = input.Name;
        entity.DefaultEndpoint = input.DefaultEndpoint;
        entity.IconUrl = input.IconUrl;
        entity.Notes = input.Notes;
        entity.IsEnabled = input.IsEnabled;
        entity.SortOrder = input.SortOrder;

        await _db.SaveChangesAsync(ct);
        var modelCount = await _db.AiModels.CountAsync(m => m.ProviderId == id, ct);
        var keyCount = await _db.AiApiKeys.CountAsync(k => k.ProviderId == id, ct);
        return ToDto(entity, modelCount, keyCount);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var entity = await _db.AiProviders.FindAsync(new object?[] { id }, ct);
        if (entity == null) return;
        if (entity.IsBuiltIn)
            throw new InvalidOperationException("内置 Provider 不可删除，可改为禁用。");

        _db.AiProviders.Remove(entity);
        await _db.SaveChangesAsync(ct);
    }

    private static AiProviderDto ToDto(AiProvider p, int modelCount, int keyCount)
        => new(p.Id, p.Code, p.Name, p.DefaultEndpoint, p.IconUrl, p.Notes,
            p.IsBuiltIn, p.IsEnabled, p.SortOrder, modelCount, keyCount);
}
