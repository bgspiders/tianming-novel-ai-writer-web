namespace TM.Web.Application.Dtos.Recall;

public record ChapterRecallResultDto(
    string ChapterId,
    string ChapterTitle,
    int ChapterNumber,
    string VolumeId,
    string Summary,
    double Score,
    IReadOnlyList<string> MatchedKeywords,
    string Reason);

public record ChapterRecallResponseDto(
    string ChapterId,
    string Query,
    string QuerySource,
    int TopK,
    IReadOnlyList<ChapterRecallResultDto> Results);
