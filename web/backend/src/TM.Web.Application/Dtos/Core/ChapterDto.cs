namespace TM.Web.Application.Dtos.Core;

public record ChapterDto(
    string Id,
    string ProjectId,
    string VolumeId,
    int ChapterNumber,
    string Title,
    int WordCount,
    string Summary,
    string Content,
    string ContentFilePath,
    string Status,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record ChapterUpsertDto(
    string ProjectId,
    string VolumeId,
    int ChapterNumber,
    string Title,
    string Summary = "",
    string Content = "",
    string Status = "planned");
