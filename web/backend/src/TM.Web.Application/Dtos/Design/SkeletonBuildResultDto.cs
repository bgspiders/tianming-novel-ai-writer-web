namespace TM.Web.Application.Dtos.Design;

public record SkeletonBuildResultDto(
    string? SourceBookId,
    int RuleCount,
    int OutlineCount,
    int VolumeDesignCount,
    int ChapterPlanCount,
    int ChapterBlueprintCount);
