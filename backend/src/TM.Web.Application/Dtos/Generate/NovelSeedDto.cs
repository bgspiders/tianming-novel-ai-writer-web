using TM.Web.Application.Dtos.Core;

namespace TM.Web.Application.Dtos.Generate;

public sealed class NovelSeedRequest
{
    public string RunId { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Genre { get; set; }
    public string? Tone { get; set; }
    public string? TargetAudience { get; set; }
    public int VolumeCount { get; set; } = 3;
    public int ChaptersPerVolume { get; set; } = 12;
    public int InitialChapterPlanCount { get; set; } = 120;
    public int EstimatedWordsPerChapter { get; set; } = 4000;
    public bool CreateChapters { get; set; } = false;
    public bool CreateDesignData { get; set; } = true;
    public string? ConfigId { get; set; }
    public string? ProviderId { get; set; }
    public string? ApiKeyId { get; set; }
    public string ApiKey { get; set; } = string.Empty;
    public string Endpoint { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public float? Temperature { get; set; } = 0.7f;
    public int? MaxTokens { get; set; } = 6000;
}

public sealed record NovelSeedResult(
    ProjectDto Project,
    IReadOnlyList<VolumeDto> Volumes,
    IReadOnlyList<ChapterDto> Chapters,
    int WorldRuleCount,
    int CharacterRuleCount,
    int FactionRuleCount,
    int LocationRuleCount,
    int OutlineCount,
    int VolumeDesignCount,
    int ChapterPlanCount,
    int ChapterBlueprintCount,
    int CreativeMaterialCount,
    int TotalPlannedChapterCount,
    int InitialChapterPlanCount,
    string RawPlan);
