using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Core;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Core;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Core;

public class SourceBookService : ISourceBookService
{
    private readonly AppDbContext _db;

    public SourceBookService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<SourceBookDto>> ListAsync(CancellationToken ct = default)
    {
        var rows = await _db.SourceBooks
            .OrderByDescending(s => s.UpdatedAt)
            .ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    public async Task<SourceBookDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var entity = await _db.SourceBooks.FindAsync(new object?[] { id }, ct);
        return entity == null ? null : ToDto(entity);
    }

    public async Task<SourceBookDto> CreateAsync(SourceBookUpsertDto input, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(input.Name))
            throw new InvalidOperationException("源书名称不能为空。");

        var entity = new SourceBook
        {
            Name = input.Name.Trim(),
            Author = input.Author ?? string.Empty,
            Genre = input.Genre ?? string.Empty,
            Site = input.Site,
            Url = input.Url,
            ChapterCount = input.ChapterCount,
            TotalWordCount = input.TotalWordCount,
            CrawledAt = input.CrawledAt,
        };
        _db.SourceBooks.Add(entity);
        await _db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    public async Task<SourceBookDto> UpdateAsync(string id, SourceBookUpsertDto input, CancellationToken ct = default)
    {
        var entity = await _db.SourceBooks.FindAsync(new object?[] { id }, ct)
                     ?? throw new InvalidOperationException("源书不存在。");

        entity.Name = (input.Name ?? string.Empty).Trim();
        entity.Author = input.Author ?? string.Empty;
        entity.Genre = input.Genre ?? string.Empty;
        entity.Site = input.Site;
        entity.Url = input.Url;
        entity.ChapterCount = input.ChapterCount;
        entity.TotalWordCount = input.TotalWordCount;
        entity.CrawledAt = input.CrawledAt;

        await _db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var entity = await _db.SourceBooks.FindAsync(new object?[] { id }, ct);
        if (entity == null) return;

        // 检查是否被设计实体引用
        var refCount =
            await _db.WorldRules.CountAsync(x => x.SourceBookId == id, ct) +
            await _db.CharacterRules.CountAsync(x => x.SourceBookId == id, ct) +
            await _db.FactionRules.CountAsync(x => x.SourceBookId == id, ct) +
            await _db.LocationRules.CountAsync(x => x.SourceBookId == id, ct) +
            await _db.PlotRules.CountAsync(x => x.SourceBookId == id, ct) +
            await _db.CreativeMaterials.CountAsync(x => x.SourceBookId == id, ct) +
            await _db.BookAnalyses.CountAsync(x => x.SourceBookId == id, ct);

        if (refCount > 0)
            throw new InvalidOperationException($"源书被 {refCount} 条设计数据引用,无法删除。");

        _db.SourceBooks.Remove(entity);
        await _db.SaveChangesAsync(ct);
    }

    private static SourceBookDto ToDto(SourceBook s)
        => new(s.Id, s.Name, s.Author, s.Genre, s.Site, s.Url,
            s.ChapterCount, s.TotalWordCount, s.CrawledAt, s.CreatedAt, s.UpdatedAt);
}
