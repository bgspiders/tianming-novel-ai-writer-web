namespace TM.Web.Application.Dtos.Editor;

public record ChapterListItemDto(
    string Id,
    string ProjectId,
    string? ProjectName,
    string? SourceBookId,
    string VolumeId,
    int VolumeNumber,
    string? VolumeTitle,
    int ChapterNumber,
    string Title,
    string Summary,
    int WordCount,
    string Status,
    string ContentFilePath,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record ChapterDetailDto(
    string Id,
    string ProjectId,
    string? ProjectName,
    string? SourceBookId,
    string VolumeId,
    int VolumeNumber,
    string? VolumeTitle,
    int ChapterNumber,
    string Title,
    string Summary,
    int WordCount,
    string Status,
    string ContentFilePath,
    string Content,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record ChapterContentUpdateDto(string Content);

public record ChapterVersionItemDto(
    string VersionId,
    string Label,
    string FileName,
    DateTime CreatedAt,
    long Size,
    bool IsCurrent);

public record ChapterVersionDetailDto(
    string VersionId,
    string Label,
    string FileName,
    DateTime CreatedAt,
    long Size,
    string Content);

public record RestoreChapterVersionRequestDto(string VersionId);
