namespace TM.Web.Application.Dtos.Generate;

public record TianmingProtocolDescriptorDto(
    string Key,
    string Command,
    string ApiId,
    string Label,
    string Description,
    string[] RequiredInputs);

public record TianmingProtocolRequest(
    string Command,
    string? ProjectId = null,
    string? SourceBookId = null,
    string? VolumeId = null,
    int? VolumeNumber = null,
    int? ChapterNumber = null,
    int? StartChapterNumber = null,
    int? EndChapterNumber = null,
    string? ChapterId = null,
    string? Prompt = null,
    string? SystemPrompt = null,
    string? ConfigId = null,
    string? ProviderId = null,
    string? ApiKeyId = null,
    string? ApiKey = null,
    string? Endpoint = null,
    string? Model = null,
    double? Temperature = null,
    int? MaxTokens = null,
    bool SaveToChapter = false);

public record TianmingProtocolResultDto(
    string Key,
    string Command,
    string ApiId,
    string Status,
    string Title,
    string Content,
    Dictionary<string, string> Metadata,
    DateTime GeneratedAt);

public record TianmingKnowledgeBaseFileDto(
    string Key,
    string FileName,
    string Title,
    string Description,
    bool IsBound,
    bool IsMissing,
    int CharacterCount,
    DateTime GeneratedAt,
    string Content);

public record TianmingKnowledgeBaseImportRequest(
    string ProjectId,
    string? SourceBookId,
    string Key,
    string Content);

public record TianmingKnowledgeBaseBindingStatusDto(
    string ProjectId,
    string? SourceBookId,
    IReadOnlyList<TianmingKnowledgeBaseFileDto> Files,
    bool AllRequiredBound,
    IReadOnlyList<string> MissingRequiredFiles);
