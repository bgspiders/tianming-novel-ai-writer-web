using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Ai;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.AI;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Ai;

public class AiModelService : IAiModelService
{
    private readonly AppDbContext _db;

    public AiModelService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<AiModelDto>> ListAsync(string providerId, CancellationToken ct = default)
    {
        var rows = await _db.AiModels
            .Where(m => m.ProviderId == providerId)
            .OrderBy(m => m.SortOrder).ThenBy(m => m.Name)
            .ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    public async Task<AiModelDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var m = await _db.AiModels.FindAsync(new object?[] { id }, ct);
        return m == null ? null : ToDto(m);
    }

    public async Task<AiModelDto> CreateAsync(string providerId, AiModelUpsertDto input, CancellationToken ct = default)
    {
        if (!await _db.AiProviders.AnyAsync(p => p.Id == providerId, ct))
            throw new InvalidOperationException("Provider 不存在。");
        if (await _db.AiModels.AnyAsync(m => m.ProviderId == providerId && m.Code == input.Code, ct))
            throw new InvalidOperationException($"模型编码 '{input.Code}' 在该 Provider 下已存在。");

        var entity = new AiModel
        {
            ProviderId = providerId,
            Code = input.Code,
            Name = input.Name,
            Description = input.Description,
            ContextWindow = input.ContextWindow,
            MaxOutputTokens = input.MaxOutputTokens,
            Capabilities = string.IsNullOrWhiteSpace(input.Capabilities) ? "{}" : input.Capabilities,
            InputPricePerMillion = input.InputPricePerMillion,
            OutputPricePerMillion = input.OutputPricePerMillion,
            IsEnabled = input.IsEnabled,
            SortOrder = input.SortOrder,
        };
        _db.AiModels.Add(entity);
        await _db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    public async Task<AiModelDto> UpdateAsync(string id, AiModelUpsertDto input, CancellationToken ct = default)
    {
        var entity = await _db.AiModels.FindAsync(new object?[] { id }, ct)
                     ?? throw new InvalidOperationException("模型不存在。");

        if (entity.Code != input.Code &&
            await _db.AiModels.AnyAsync(m => m.ProviderId == entity.ProviderId && m.Code == input.Code && m.Id != id, ct))
        {
            throw new InvalidOperationException($"模型编码 '{input.Code}' 已被占用。");
        }

        entity.Code = input.Code;
        entity.Name = input.Name;
        entity.Description = input.Description;
        entity.ContextWindow = input.ContextWindow;
        entity.MaxOutputTokens = input.MaxOutputTokens;
        entity.Capabilities = string.IsNullOrWhiteSpace(input.Capabilities) ? "{}" : input.Capabilities;
        entity.InputPricePerMillion = input.InputPricePerMillion;
        entity.OutputPricePerMillion = input.OutputPricePerMillion;
        entity.IsEnabled = input.IsEnabled;
        entity.SortOrder = input.SortOrder;

        await _db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var entity = await _db.AiModels.FindAsync(new object?[] { id }, ct);
        if (entity == null) return;
        _db.AiModels.Remove(entity);
        await _db.SaveChangesAsync(ct);
    }

    private static AiModelDto ToDto(AiModel m)
        => new(m.Id, m.ProviderId, m.Code, m.Name, m.Description, m.ContextWindow, m.MaxOutputTokens,
            m.Capabilities, m.InputPricePerMillion, m.OutputPricePerMillion, m.IsEnabled, m.SortOrder);
}
