using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using TM.Services.Modules.ProjectData.Implementations;
using TM.Services.Modules.ProjectData.Implementations.Tracking.Rules;
using TM.Services.Modules.ProjectData.Models.Tracking;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;

namespace TM.Web.LegacyBridge.Generation;

public sealed class LegacyGenerationGateService : IGenerationGateService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = false
    };

    private readonly GenerationGate _gate;

    public LegacyGenerationGateService()
    {
        _gate = new GenerationGate(new LedgerConsistencyChecker(), new LedgerRuleSetProvider());
    }

    public async Task<GenerationGateResultDto> ValidateAsync(GenerationGateRequest request, CancellationToken ct = default)
    {
        ct.ThrowIfCancellationRequested();

        var result = await _gate.ValidateAsync(
            request.ChapterId,
            request.RawContent,
            ToFactSnapshot(request.FactSnapshot),
            ToDesignElements(request.DesignElements));

        return ToDto(result);
    }

    private static FactSnapshot ToFactSnapshot(GenerationGateFactSnapshotDto source)
    {
        var snapshot = new FactSnapshot();

        foreach (var character in source.CharacterStates)
        {
            snapshot.CharacterStates.Add(new CharacterStateSnapshot
            {
                Id = character.Id,
                Name = character.Name,
                Stage = character.Stage,
                Abilities = character.Abilities,
                Relationships = character.Relationships
            });
        }

        foreach (var conflict in source.ConflictProgress)
        {
            snapshot.ConflictProgress.Add(new ConflictProgressSnapshot
            {
                Id = conflict.Id,
                Name = conflict.Name,
                Status = conflict.Status,
                RecentProgress = conflict.RecentProgress
            });
        }

        foreach (var foreshadowing in source.ForeshadowingStatus)
        {
            snapshot.ForeshadowingStatus.Add(new ForeshadowingStatusSnapshot
            {
                Id = foreshadowing.Id,
                Name = foreshadowing.Name,
                IsSetup = foreshadowing.IsSetup,
                IsResolved = foreshadowing.IsResolved,
                IsOverdue = foreshadowing.IsOverdue,
                SetupChapterId = foreshadowing.SetupChapterId,
                PayoffChapterId = foreshadowing.PayoffChapterId
            });
        }

        foreach (var plotPoint in source.PlotPoints)
        {
            snapshot.PlotPoints.Add(new PlotPointSnapshot
            {
                Id = plotPoint.Id,
                Summary = plotPoint.Summary,
                ChapterId = plotPoint.ChapterId,
                RelatedEntityIds = plotPoint.RelatedEntityIds,
                Storyline = plotPoint.Storyline
            });
        }

        foreach (var desc in source.CharacterDescriptions)
        {
            snapshot.CharacterDescriptions[desc.Id] = new CharacterCoreDescription
            {
                Id = desc.Id,
                Name = desc.Name,
                Appearance = desc.Appearance,
                PersonalityTags = desc.PersonalityTags
            };
        }

        foreach (var desc in source.LocationDescriptions)
        {
            snapshot.LocationDescriptions[desc.Id] = new LocationCoreDescription
            {
                Id = desc.Id,
                Name = desc.Name,
                Description = desc.Description,
                Features = desc.Features
            };
        }

        foreach (var rule in source.WorldRuleConstraints)
        {
            snapshot.WorldRuleConstraints.Add(new WorldRuleConstraint
            {
                RuleId = rule.RuleId,
                RuleName = rule.RuleName,
                Constraint = rule.Constraint,
                IsHardConstraint = rule.IsHardConstraint
            });
        }

        foreach (var location in source.LocationStates)
        {
            snapshot.LocationStates.Add(new LocationStateSnapshot
            {
                Id = location.Id,
                Name = location.Name,
                Status = location.Status,
                ChapterId = location.ChapterId
            });
        }

        foreach (var faction in source.FactionStates)
        {
            snapshot.FactionStates.Add(new FactionStateSnapshot
            {
                Id = faction.Id,
                Name = faction.Name,
                Status = faction.Status,
                ChapterId = faction.ChapterId
            });
        }

        foreach (var timeline in source.Timeline)
        {
            snapshot.Timeline.Add(new TimelineSnapshot
            {
                ChapterId = timeline.ChapterId,
                TimePeriod = timeline.TimePeriod,
                ElapsedTime = timeline.ElapsedTime,
                KeyTimeEvent = timeline.KeyTimeEvent
            });
        }

        foreach (var location in source.CharacterLocations)
        {
            snapshot.CharacterLocations.Add(new CharacterLocationSnapshot
            {
                CharacterId = location.CharacterId,
                CharacterName = location.CharacterName,
                CurrentLocation = location.CurrentLocation,
                ChapterId = location.ChapterId
            });
        }

        foreach (var item in source.ItemStates)
        {
            snapshot.ItemStates.Add(new ItemStateSnapshot
            {
                Id = item.Id,
                Name = item.Name,
                CurrentHolder = item.CurrentHolder,
                Status = item.Status,
                ChapterId = item.ChapterId
            });
        }

        return snapshot;
    }

    private static DesignElementNames? ToDesignElements(GenerationGateDesignElementsDto? source)
    {
        if (source == null)
        {
            return null;
        }

        return new DesignElementNames
        {
            CharacterNames = source.CharacterNames,
            FactionNames = source.FactionNames,
            LocationNames = source.LocationNames,
            PlotKeyNames = source.PlotKeyNames,
            PovCharacterNames = source.PovCharacterNames
        };
    }

    private static GenerationGateResultDto ToDto(GateResult result)
    {
        var failures = result.Failures
            .Select(f => new GenerationGateFailureDto
            {
                Type = f.Type.ToString(),
                Errors = f.Errors
            })
            .ToList();

        return new GenerationGateResultDto
        {
            Success = result.Success,
            Failures = failures,
            FailureStages = failures.Select(f => f.Type).Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
            ContentWithoutChanges = result.ContentWithoutChanges,
            ParsedChangesJson = result.ParsedChanges == null ? null : JsonSerializer.Serialize(result.ParsedChanges, JsonOptions),
            AllFailures = result.GetAllFailures()
        };
    }
}
