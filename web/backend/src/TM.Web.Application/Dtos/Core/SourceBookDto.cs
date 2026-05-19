namespace TM.Web.Application.Dtos.Core;

public record SourceBookDto(
    string Id,
    string Name,
    string Author,
    string Genre,
    string? Site,
    string? Url,
    int ChapterCount,
    int TotalWordCount,
    DateTime? CrawledAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record SourceBookUpsertDto(
    string Name,
    string Author = "",
    string Genre = "",
    string? Site = null,
    string? Url = null,
    int ChapterCount = 0,
    int TotalWordCount = 0,
    DateTime? CrawledAt = null);
