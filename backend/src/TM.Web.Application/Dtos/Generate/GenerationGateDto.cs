using System.Collections.Generic;

namespace TM.Web.Application.Dtos.Generate;

public sealed class GenerationGateRequest
{
    public string ChapterId { get; set; } = string.Empty;

    public string RawContent { get; set; } = string.Empty;

    public GenerationGateFactSnapshotDto FactSnapshot { get; set; } = new();

    public GenerationGateDesignElementsDto? DesignElements { get; set; }
}

public sealed class GenerationGateFactSnapshotDto
{
    public List<GenerationGateCharacterStateDto> CharacterStates { get; set; } = new();

    public List<GenerationGateConflictProgressDto> ConflictProgress { get; set; } = new();

    public List<GenerationGateForeshadowingStatusDto> ForeshadowingStatus { get; set; } = new();

    public List<GenerationGatePlotPointDto> PlotPoints { get; set; } = new();

    public List<GenerationGateCharacterDescriptionDto> CharacterDescriptions { get; set; } = new();

    public List<GenerationGateLocationDescriptionDto> LocationDescriptions { get; set; } = new();

    public List<GenerationGateWorldRuleConstraintDto> WorldRuleConstraints { get; set; } = new();

    public List<GenerationGateLocationStateDto> LocationStates { get; set; } = new();

    public List<GenerationGateFactionStateDto> FactionStates { get; set; } = new();

    public List<GenerationGateTimelineDto> Timeline { get; set; } = new();

    public List<GenerationGateCharacterLocationDto> CharacterLocations { get; set; } = new();

    public List<GenerationGateItemStateDto> ItemStates { get; set; } = new();
}

public sealed class GenerationGateCharacterStateDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Stage { get; set; } = string.Empty;

    public string Abilities { get; set; } = string.Empty;

    public string Relationships { get; set; } = string.Empty;
}

public sealed class GenerationGateCharacterDescriptionDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Appearance { get; set; } = string.Empty;

    public List<string> PersonalityTags { get; set; } = new();
}

public sealed class GenerationGateLocationDescriptionDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public List<string> Features { get; set; } = new();
}

public sealed class GenerationGateConflictProgressDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public List<string> RecentProgress { get; set; } = new();
}

public sealed class GenerationGateForeshadowingStatusDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public bool IsSetup { get; set; }

    public bool IsResolved { get; set; }

    public bool IsOverdue { get; set; }

    public string? SetupChapterId { get; set; }

    public string? PayoffChapterId { get; set; }
}

public sealed class GenerationGatePlotPointDto
{
    public string Id { get; set; } = string.Empty;

    public string Summary { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;

    public List<string> RelatedEntityIds { get; set; } = new();

    public string Storyline { get; set; } = "main";
}

public sealed class GenerationGateLocationStateDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;
}

public sealed class GenerationGateFactionStateDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;
}

public sealed class GenerationGateTimelineDto
{
    public string ChapterId { get; set; } = string.Empty;

    public string TimePeriod { get; set; } = string.Empty;

    public string ElapsedTime { get; set; } = string.Empty;

    public string KeyTimeEvent { get; set; } = string.Empty;
}

public sealed class GenerationGateCharacterLocationDto
{
    public string CharacterId { get; set; } = string.Empty;

    public string CharacterName { get; set; } = string.Empty;

    public string CurrentLocation { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;
}

public sealed class GenerationGateItemStateDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string CurrentHolder { get; set; } = string.Empty;

    public string Status { get; set; } = "active";

    public string ChapterId { get; set; } = string.Empty;
}

public sealed class GenerationGateWorldRuleConstraintDto
{
    public string RuleId { get; set; } = string.Empty;

    public string RuleName { get; set; } = string.Empty;

    public string Constraint { get; set; } = string.Empty;

    public bool IsHardConstraint { get; set; } = true;
}

public sealed class GenerationGateDesignElementsDto
{
    public List<string> CharacterNames { get; set; } = new();

    public List<string> FactionNames { get; set; } = new();

    public List<string> LocationNames { get; set; } = new();

    public List<string> PlotKeyNames { get; set; } = new();

    public List<string> PovCharacterNames { get; set; } = new();
}

public sealed class GenerationGateResultDto
{
    public bool Success { get; set; }

    public List<GenerationGateFailureDto> Failures { get; set; } = new();

    public List<string> FailureStages { get; set; } = new();

    public string? ContentWithoutChanges { get; set; }

    public string? ParsedChangesJson { get; set; }

    public List<string> AllFailures { get; set; } = new();
}

public sealed class GenerationGateFailureDto
{
    public string Type { get; set; } = string.Empty;

    public List<string> Errors { get; set; } = new();
}
