namespace TM.Web.Application.Dtos.Design;

public record BookAnalysisCrawlPreviewRequest(
    string Url,
    int MaxChapters = 12,
    bool IncludeContent = true);

public record BookAnalysisCrawlChapterDto(
    int Index,
    string Title,
    string Url,
    string Summary,
    int WordCount,
    string Content);

public record BookAnalysisCrawlPreviewDto(
    string SourceUrl,
    string SourceSite,
    string SuggestedName,
    string Title,
    string Author,
    string Genre,
    string Keywords,
    int ChapterCount,
    int TotalWordCount,
    DateTime CrawledAt,
    string Summary,
    string WorldBuildingMethod,
    string PowerSystemDesign,
    string EnvironmentDescription,
    string FactionDesign,
    string WorldviewHighlights,
    string ProtagonistDesign,
    string SupportingRoles,
    string CharacterRelations,
    string GoldenFingerDesign,
    string CharacterHighlights,
    string PlotStructure,
    string ConflictDesign,
    string ClimaxArrangement,
    string ForeshadowingTechnique,
    string PlotHighlights,
    IReadOnlyList<BookAnalysisCrawlChapterDto> Chapters);
