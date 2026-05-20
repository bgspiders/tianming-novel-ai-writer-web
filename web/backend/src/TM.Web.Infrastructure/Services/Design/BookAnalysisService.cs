using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Design;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Design;

public class BookAnalysisService : IBookAnalysisService
{
    private readonly AppDbContext _db;
    public BookAnalysisService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<BookAnalysisDto>> ListAsync(DesignListQuery query, CancellationToken ct = default)
    {
        query = await _db.ResolveProjectScopeAsync(query, ct);
        var rows = await _db.BookAnalyses.AsQueryable().ApplyFilter(query).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<PagedResult<BookAnalysisDto>> ListPagedAsync(DesignListQuery query, CancellationToken ct = default)
    {
        query = await _db.ResolveProjectScopeAsync(query, ct);
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var filtered = _db.BookAnalyses.AsQueryable().ApplyFilter(query);
        var total = await filtered.CountAsync(ct);
        var rows = await filtered.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return new PagedResult<BookAnalysisDto>(rows.Select(Map).ToList(), total, page, pageSize);
    }

    public async Task<BookAnalysisDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.BookAnalyses.FindAsync(new object?[] { id }, ct);
        return e == null ? null : Map(e);
    }

    public async Task<BookAnalysisDto> CreateAsync(BookAnalysisUpsertDto input, CancellationToken ct = default)
    {
        var sourceBookId = await _db.ResolveWriteSourceBookIdAsync(input.ProjectId, input.SourceBookId, ct);
        var e = new BookAnalysis();
        Apply(e, input, sourceBookId);
        _db.BookAnalyses.Add(e);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task<BookAnalysisDto> UpdateAsync(string id, BookAnalysisUpsertDto input, CancellationToken ct = default)
    {
        var e = await _db.BookAnalyses.FindAsync(new object?[] { id }, ct)
                ?? throw new InvalidOperationException("拆书数据不存在。");
        var sourceBookId = await _db.ResolveWriteSourceBookIdAsync(input.ProjectId, input.SourceBookId, ct);
        Apply(e, input, sourceBookId);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.BookAnalyses.FindAsync(new object?[] { id }, ct);
        if (e == null) return;
        _db.BookAnalyses.Remove(e);
        await _db.SaveChangesAsync(ct);
    }

    private static void Apply(BookAnalysis e, BookAnalysisUpsertDto i, string? sourceBookId)
    {
        if (string.IsNullOrWhiteSpace(i.Name)) throw new InvalidOperationException("名称必填。");
        e.Name = i.Name.Trim();
        e.Category = i.Category ?? "";
        e.CategoryId = string.IsNullOrEmpty(i.CategoryId) ? null : i.CategoryId;
        e.IsEnabled = i.IsEnabled;
        e.SourceBookId = sourceBookId;
        e.Icon = string.IsNullOrEmpty(i.Icon) ? "📖" : i.Icon;
        e.Author = i.Author ?? "";
        e.Genre = i.Genre ?? "";
        e.SourceUrl = i.SourceUrl ?? "";
        e.SourceBookTitle = i.SourceBookTitle ?? "";
        e.SourceAuthor = i.SourceAuthor ?? "";
        e.SourceGenre = i.SourceGenre ?? "";
        e.SourceKeywords = i.SourceKeywords ?? "";
        e.SourceSite = i.SourceSite ?? "";
        e.ChapterCount = i.ChapterCount;
        e.TotalWordCount = i.TotalWordCount;
        e.CrawledAt = i.CrawledAt;
        e.WorldBuildingMethod = i.WorldBuildingMethod ?? "";
        e.PowerSystemDesign = i.PowerSystemDesign ?? "";
        e.EnvironmentDescription = i.EnvironmentDescription ?? "";
        e.FactionDesign = i.FactionDesign ?? "";
        e.WorldviewHighlights = i.WorldviewHighlights ?? "";
        e.ProtagonistDesign = i.ProtagonistDesign ?? "";
        e.SupportingRoles = i.SupportingRoles ?? "";
        e.CharacterRelations = i.CharacterRelations ?? "";
        e.GoldenFingerDesign = i.GoldenFingerDesign ?? "";
        e.CharacterHighlights = i.CharacterHighlights ?? "";
        e.PlotStructure = i.PlotStructure ?? "";
        e.ConflictDesign = i.ConflictDesign ?? "";
        e.ClimaxArrangement = i.ClimaxArrangement ?? "";
        e.ForeshadowingTechnique = i.ForeshadowingTechnique ?? "";
        e.PlotHighlights = i.PlotHighlights ?? "";
    }

    private static BookAnalysisDto Map(BookAnalysis e)
        => new(e.Id, e.Name, e.Category, e.CategoryId, e.IsEnabled, e.SourceBookId,
            e.Icon, e.Author, e.Genre, e.SourceUrl,
            e.SourceBookTitle, e.SourceAuthor, e.SourceGenre, e.SourceKeywords, e.SourceSite,
            e.ChapterCount, e.TotalWordCount, e.CrawledAt,
            e.WorldBuildingMethod, e.PowerSystemDesign, e.EnvironmentDescription,
            e.FactionDesign, e.WorldviewHighlights,
            e.ProtagonistDesign, e.SupportingRoles, e.CharacterRelations,
            e.GoldenFingerDesign, e.CharacterHighlights,
            e.PlotStructure, e.ConflictDesign, e.ClimaxArrangement,
            e.ForeshadowingTechnique, e.PlotHighlights,
            e.CreatedAt, e.UpdatedAt);
}
