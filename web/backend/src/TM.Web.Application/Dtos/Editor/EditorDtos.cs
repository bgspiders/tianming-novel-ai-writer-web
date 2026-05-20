using TM.Web.Application.Dtos.Core;

namespace TM.Web.Application.Dtos.Editor;

public sealed record EditorSearchRequest(
    string ProjectId,
    string Query,
    int TopK = 8);

public sealed record EditorSearchResultDto(
    string ChapterId,
    string ProjectId,
    string VolumeId,
    int ChapterNumber,
    string Title,
    string Summary,
    string Snippet,
    double Score,
    IReadOnlyList<string> MatchedKeywords);

public sealed record EditorChapterAssistDto(
    ChapterDto Chapter,
    IReadOnlyList<EditorSearchResultDto> Related);

public sealed record EditorSaveChapterRequest(
    string Content,
    string? Status = "drafted");

public sealed record EditorIndexStatusDto(
    string ProjectId,
    int IndexedChapterCount,
    int TotalChapterCount,
    int KeywordCount,
    DateTime? LastBuiltAt,
    int StaleChapterCount,
    string Status);

public sealed record EditorIndexRebuildRequest(
    string ProjectId);

public sealed record EditorIndexRebuildResultDto(
    string ProjectId,
    int IndexedChapterCount,
    int TotalChapterCount,
    int KeywordCount,
    DateTime? LastBuiltAt,
    int StaleChapterCount,
    string Status,
    int RebuiltChapterCount);
