using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Domain.Common;
using TM.Web.Domain.Entities.Tracking;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Generation;

public sealed class GenerationStateService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    private readonly AppDbContext _db;

    public GenerationStateService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<GenerationGateRequest> BuildGateRequestAsync(
        string projectId,
        string chapterId,
        string rawContent,
        CancellationToken ct)
    {
        var project = await _db.Projects.AsNoTracking().FirstAsync(p => p.Id == projectId, ct);
        var chapter = await _db.Chapters.AsNoTracking().FirstAsync(c => c.Id == chapterId, ct);
        var sourceBookId = project.CurrentSourceBookId;

        var factSnapshot = new GenerationGateFactSnapshotDto();
        var designElements = new GenerationGateDesignElementsDto();

        await AddDesignFactsAsync(factSnapshot, designElements, sourceBookId, chapterId, chapter.ChapterNumber, ct);
        await AddRuntimeFactsAsync(factSnapshot, projectId, sourceBookId, ct);

        Deduplicate(designElements.CharacterNames);
        Deduplicate(designElements.FactionNames);
        Deduplicate(designElements.LocationNames);
        Deduplicate(designElements.PlotKeyNames);
        Deduplicate(designElements.PovCharacterNames);

        return new GenerationGateRequest
        {
            ChapterId = chapterId,
            RawContent = rawContent,
            FactSnapshot = factSnapshot,
            DesignElements = designElements
        };
    }

    public async Task ApplyParsedChangesAsync(
        string projectId,
        string? sourceBookId,
        string chapterId,
        string? parsedChangesJson,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(parsedChangesJson))
        {
            return;
        }

        var changes = JsonSerializer.Deserialize<ParsedChapterChanges>(parsedChangesJson, JsonOptions);
        if (changes == null)
        {
            return;
        }

        await ClearChapterDerivedStateAsync(projectId, chapterId, ct);
        await ApplyCharacterChangesAsync(projectId, sourceBookId, chapterId, changes.CharacterStateChanges, ct);
        await ApplyConflictChangesAsync(projectId, sourceBookId, chapterId, changes.ConflictProgress, ct);
        await ApplyForeshadowingChangesAsync(projectId, sourceBookId, chapterId, changes.ForeshadowingActions, ct);
        await ApplyPlotPointsAsync(projectId, sourceBookId, chapterId, changes.NewPlotPoints, ct);
        await ApplyLocationChangesAsync(projectId, sourceBookId, chapterId, changes.LocationStateChanges, ct);
        await ApplyFactionChangesAsync(projectId, sourceBookId, chapterId, changes.FactionStateChanges, ct);
        await ApplyTimelineAsync(projectId, sourceBookId, chapterId, changes.TimeProgression, ct);
        await ApplyMovementsAsync(projectId, sourceBookId, chapterId, changes.CharacterMovements, ct);
        await ApplyItemTransfersAsync(projectId, sourceBookId, chapterId, changes.ItemTransfers, ct);
    }

    private async Task ClearChapterDerivedStateAsync(string projectId, string chapterId, CancellationToken ct)
    {
        var characterPointIds = await _db.CharacterStatePoints
            .Where(x => x.ChapterId == chapterId)
            .Select(x => x.Id)
            .ToListAsync(ct);
        if (characterPointIds.Count > 0)
        {
            _db.CharacterStatePoints.RemoveRange(_db.CharacterStatePoints.Where(x => characterPointIds.Contains(x.Id)));
        }

        _db.CharacterRelationshipStates.RemoveRange(
            _db.CharacterRelationshipStates.Where(x => x.ChapterId == chapterId));
        _db.ConflictProgressPoints.RemoveRange(
            _db.ConflictProgressPoints.Where(x => x.ChapterId == chapterId));
        _db.LocationStatePoints.RemoveRange(
            _db.LocationStatePoints.Where(x => x.ChapterId == chapterId));
        _db.FactionStatePoints.RemoveRange(
            _db.FactionStatePoints.Where(x => x.ChapterId == chapterId));
        _db.ItemStatePoints.RemoveRange(
            _db.ItemStatePoints.Where(x => x.ChapterId == chapterId));
        _db.CharacterMovements.RemoveRange(
            _db.CharacterMovements.Where(x => x.ProjectId == projectId && x.ChapterId == chapterId));
        _db.PlotPoints.RemoveRange(
            _db.PlotPoints.Where(x => x.ProjectId == projectId && x.ChapterId == chapterId));
        _db.ChapterTimelines.RemoveRange(
            _db.ChapterTimelines.Where(x => x.ProjectId == projectId && x.ChapterId == chapterId));
    }

    private async Task AddDesignFactsAsync(
        GenerationGateFactSnapshotDto factSnapshot,
        GenerationGateDesignElementsDto designElements,
        string? sourceBookId,
        string chapterId,
        int chapterNumber,
        CancellationToken ct)
    {
        var characters = await FilterBySourceBook(_db.CharacterRules.AsNoTracking().Where(x => x.IsEnabled), sourceBookId)
            .ToListAsync(ct);
        foreach (var character in characters)
        {
            if (!factSnapshot.CharacterStates.Any(x => x.Id == character.Id))
            {
                factSnapshot.CharacterStates.Add(new GenerationGateCharacterStateDto
                {
                    Id = character.Id,
                    Name = character.Name,
                    Stage = FirstNonEmpty(character.CharacterType, character.Identity),
                    Abilities = JoinNonEmpty(character.CombatSkills, character.NonCombatSkills, character.SpecialAbilities),
                    Relationships = JoinNonEmpty(character.TargetCharacterName, character.RelationshipType, character.EmotionDynamic)
                });
            }

            factSnapshot.CharacterDescriptions.Add(new GenerationGateCharacterDescriptionDto
            {
                Id = character.Id,
                Name = character.Name,
                Appearance = character.Appearance,
                PersonalityTags = SplitTags(JoinNonEmpty(character.Identity, character.CharacterType, character.Race))
            });
        }

        var locations = await FilterBySourceBook(_db.LocationRules.AsNoTracking().Where(x => x.IsEnabled), sourceBookId)
            .ToListAsync(ct);
        foreach (var location in locations)
        {
            factSnapshot.LocationDescriptions.Add(new GenerationGateLocationDescriptionDto
            {
                Id = location.Id,
                Name = location.Name,
                Description = location.Description,
                Features = SplitTags(JoinNonEmpty(location.LocationType, location.Terrain, location.Climate, string.Join("、", location.Landmarks)))
            });
        }

        var worldRules = await FilterBySourceBook(_db.WorldRules.AsNoTracking().Where(x => x.IsEnabled), sourceBookId)
            .ToListAsync(ct);
        foreach (var rule in worldRules)
        {
            foreach (var constraint in SplitRuleLines(rule.HardRules))
            {
                factSnapshot.WorldRuleConstraints.Add(new GenerationGateWorldRuleConstraintDto
                {
                    RuleId = rule.Id,
                    RuleName = rule.Name,
                    Constraint = constraint,
                    IsHardConstraint = true
                });
            }
        }

        var chapterPlan = await FilterBySourceBook(_db.ChapterPlans.AsNoTracking().Where(x => x.IsEnabled), sourceBookId)
            .Where(x => x.ChapterNumber == chapterNumber)
            .OrderByDescending(x => x.UpdatedAt)
            .FirstOrDefaultAsync(ct);
        if (chapterPlan != null)
        {
            designElements.CharacterNames.AddRange(chapterPlan.ReferencedCharacterNames);
            designElements.FactionNames.AddRange(chapterPlan.ReferencedFactionNames);
            designElements.LocationNames.AddRange(chapterPlan.ReferencedLocationNames);
            designElements.PlotKeyNames.AddRange(SplitTags(chapterPlan.MainPlotProgress));
        }

        var blueprints = await FilterBySourceBook(_db.ChapterBlueprints.AsNoTracking().Where(x => x.IsEnabled), sourceBookId)
            .Where(x => x.ChapterId == chapterId)
            .ToListAsync(ct);
        foreach (var blueprint in blueprints)
        {
            designElements.PovCharacterNames.AddRange(SplitTags(blueprint.PovCharacter));
            designElements.CharacterNames.AddRange(SplitTags(blueprint.Cast));
            designElements.FactionNames.AddRange(SplitTags(blueprint.Factions));
            designElements.LocationNames.AddRange(SplitTags(blueprint.Locations));
            designElements.PlotKeyNames.AddRange(SplitTags(blueprint.ItemsClues));
        }
    }

    private async Task AddRuntimeFactsAsync(
        GenerationGateFactSnapshotDto factSnapshot,
        string projectId,
        string? sourceBookId,
        CancellationToken ct)
    {
        var characterEntries = await FilterTrackingBySourceBook(_db.CharacterStateEntries.AsNoTracking().Where(x => x.ProjectId == projectId), sourceBookId)
            .ToListAsync(ct);
        var characterEntryIds = characterEntries.Select(x => x.Id).ToList();
        var characterPoints = await _db.CharacterStatePoints.AsNoTracking()
            .Where(x => characterEntryIds.Contains(x.CharacterStateEntryId))
            .ToListAsync(ct);
        var characterPointMap = characterPoints
            .GroupBy(x => x.CharacterStateEntryId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.CreatedAt).First());
        foreach (var entry in characterEntries)
        {
            characterPointMap.TryGetValue(entry.Id, out var point);
            var existing = factSnapshot.CharacterStates.FirstOrDefault(x => x.Id == entry.CharacterId);
            if (existing == null)
            {
                factSnapshot.CharacterStates.Add(new GenerationGateCharacterStateDto
                {
                    Id = entry.CharacterId,
                    Name = entry.Name,
                    Stage = point?.Level ?? string.Empty,
                    Abilities = point == null ? string.Empty : string.Join("、", point.Abilities),
                    Relationships = entry.BaseProfile
                });
            }
            else if (point != null)
            {
                existing.Stage = FirstNonEmpty(point.Level, existing.Stage);
                existing.Abilities = FirstNonEmpty(string.Join("、", point.Abilities), existing.Abilities);
            }
        }

        var conflicts = await FilterTrackingBySourceBook(_db.ConflictProgressEntries.AsNoTracking().Where(x => x.ProjectId == projectId), sourceBookId)
            .ToListAsync(ct);
        var conflictIds = conflicts.Select(x => x.Id).ToList();
        var conflictPoints = await _db.ConflictProgressPoints.AsNoTracking()
            .Where(x => conflictIds.Contains(x.ConflictProgressEntryId))
            .ToListAsync(ct);
        var conflictPointMap = conflictPoints
            .GroupBy(x => x.ConflictProgressEntryId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.CreatedAt).Take(5).ToList());
        foreach (var conflict in conflicts)
        {
            conflictPointMap.TryGetValue(conflict.Id, out var points);
            factSnapshot.ConflictProgress.Add(new GenerationGateConflictProgressDto
            {
                Id = conflict.Id,
                Name = conflict.Name,
                Status = conflict.Status,
                RecentProgress = points?.Select(x => FirstNonEmpty(x.Event, x.Description)).Where(x => x.Length > 0).ToList() ?? new List<string>()
            });
        }

        var foreshadowings = await FilterTrackingBySourceBook(_db.Foreshadowings.AsNoTracking().Where(x => x.ProjectId == projectId), sourceBookId)
            .ToListAsync(ct);
        factSnapshot.ForeshadowingStatus.AddRange(foreshadowings.Select(x => new GenerationGateForeshadowingStatusDto
        {
            Id = x.Id,
            Name = x.Name,
            IsSetup = x.IsSetup,
            IsResolved = x.IsResolved,
            IsOverdue = x.IsOverdue,
            SetupChapterId = NullIfEmpty(x.ActualSetupChapter),
            PayoffChapterId = NullIfEmpty(x.ActualPayoffChapter)
        }));

        var plotPoints = await FilterTrackingBySourceBook(_db.PlotPoints.AsNoTracking().Where(x => x.ProjectId == projectId), sourceBookId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(200)
            .ToListAsync(ct);
        factSnapshot.PlotPoints.AddRange(plotPoints.Select(x => new GenerationGatePlotPointDto
        {
            Id = x.Id,
            Summary = x.Context,
            ChapterId = x.ChapterId,
            RelatedEntityIds = x.InvolvedCharacters,
            Storyline = x.Storyline
        }));

        var locationEntries = await FilterTrackingBySourceBook(_db.LocationStateEntries.AsNoTracking().Where(x => x.ProjectId == projectId), sourceBookId)
            .ToListAsync(ct);
        factSnapshot.LocationStates.AddRange(locationEntries.Select(x => new GenerationGateLocationStateDto
        {
            Id = x.LocationId,
            Name = x.Name,
            Status = x.CurrentStatus,
            ChapterId = string.Empty
        }));

        var factionEntries = await FilterTrackingBySourceBook(_db.FactionStateEntries.AsNoTracking().Where(x => x.ProjectId == projectId), sourceBookId)
            .ToListAsync(ct);
        factSnapshot.FactionStates.AddRange(factionEntries.Select(x => new GenerationGateFactionStateDto
        {
            Id = x.FactionId,
            Name = x.Name,
            Status = x.CurrentStatus,
            ChapterId = string.Empty
        }));

        var timelines = await FilterTrackingBySourceBook(_db.ChapterTimelines.AsNoTracking().Where(x => x.ProjectId == projectId), sourceBookId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(20)
            .ToListAsync(ct);
        factSnapshot.Timeline.AddRange(timelines.Select(x => new GenerationGateTimelineDto
        {
            ChapterId = x.ChapterId,
            TimePeriod = x.TimePeriod,
            ElapsedTime = x.ElapsedTime,
            KeyTimeEvent = x.KeyTimeEvent
        }));

        var characterLocations = await FilterTrackingBySourceBook(_db.CharacterLocations.AsNoTracking().Where(x => x.ProjectId == projectId), sourceBookId)
            .ToListAsync(ct);
        factSnapshot.CharacterLocations.AddRange(characterLocations.Select(x => new GenerationGateCharacterLocationDto
        {
            CharacterId = x.CharacterName,
            CharacterName = x.CharacterName,
            CurrentLocation = x.CurrentLocation,
            ChapterId = x.LastUpdatedChapter
        }));

        var items = await FilterTrackingBySourceBook(_db.ItemStateEntries.AsNoTracking().Where(x => x.ProjectId == projectId), sourceBookId)
            .ToListAsync(ct);
        factSnapshot.ItemStates.AddRange(items.Select(x => new GenerationGateItemStateDto
        {
            Id = x.Id,
            Name = x.Name,
            CurrentHolder = x.CurrentHolder,
            Status = x.CurrentStatus,
            ChapterId = string.Empty
        }));
    }

    private async Task ApplyCharacterChangesAsync(string projectId, string? sourceBookId, string chapterId, List<ParsedCharacterStateChange> changes, CancellationToken ct)
    {
        foreach (var change in changes.Where(x => !string.IsNullOrWhiteSpace(x.CharacterId)))
        {
            var entry = await GetOrCreateCharacterEntryAsync(projectId, sourceBookId, change.CharacterId, ct);
            var abilities = change.NewAbilities.Concat(change.LostAbilities.Select(x => $"失去:{x}")).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList();
            _db.CharacterStatePoints.Add(new CharacterStatePoint
            {
                CharacterStateEntryId = entry.Id,
                ChapterId = chapterId,
                Level = change.NewLevel,
                Abilities = abilities,
                MentalState = change.NewMentalState,
                KeyEvent = change.KeyEvent,
                Importance = FirstNonEmpty(change.Importance, "normal")
            });

            foreach (var (target, relation) in change.RelationshipChanges)
            {
                _db.CharacterRelationshipStates.Add(new CharacterRelationshipState
                {
                    CharacterStateEntryId = entry.Id,
                    TargetCharacterName = target,
                    ChapterId = chapterId,
                    Relation = relation.Relation,
                    Trust = relation.TrustDelta
                });
            }
        }
    }

    private async Task ApplyConflictChangesAsync(string projectId, string? sourceBookId, string chapterId, List<ParsedConflictProgressChange> changes, CancellationToken ct)
    {
        foreach (var change in changes.Where(x => !string.IsNullOrWhiteSpace(x.ConflictId)))
        {
            var entry = await _db.ConflictProgressEntries.FirstOrDefaultAsync(x => x.ProjectId == projectId && x.Id == change.ConflictId, ct);
            if (entry == null)
            {
                entry = new ConflictProgressEntry
                {
                    Id = change.ConflictId,
                    ProjectId = projectId,
                    SourceBookId = sourceBookId,
                    Name = change.ConflictId
                };
                _db.ConflictProgressEntries.Add(entry);
            }

            entry.Status = FirstNonEmpty(change.NewStatus, entry.Status);
            if (!entry.InvolvedChapters.Contains(chapterId)) entry.InvolvedChapters.Add(chapterId);
            _db.ConflictProgressPoints.Add(new ConflictProgressPoint
            {
                ConflictProgressEntryId = entry.Id,
                ChapterId = chapterId,
                Event = change.Event,
                Status = change.NewStatus,
                Description = change.Event,
                Importance = FirstNonEmpty(change.Importance, "normal")
            });
        }
    }

    private async Task ApplyForeshadowingChangesAsync(string projectId, string? sourceBookId, string chapterId, List<ParsedForeshadowingAction> actions, CancellationToken ct)
    {
        foreach (var action in actions.Where(x => !string.IsNullOrWhiteSpace(x.ForeshadowId)))
        {
            var entry = await _db.Foreshadowings.FirstOrDefaultAsync(x => x.ProjectId == projectId && x.Id == action.ForeshadowId, ct);
            if (entry == null)
            {
                entry = new Foreshadowing
                {
                    Id = action.ForeshadowId,
                    ProjectId = projectId,
                    SourceBookId = sourceBookId,
                    Name = action.ForeshadowId
                };
                _db.Foreshadowings.Add(entry);
            }

            var normalized = (action.Action ?? string.Empty).Trim().ToLowerInvariant();
            if (normalized == "setup" || normalized.Contains("埋"))
            {
                entry.IsSetup = true;
                entry.ActualSetupChapter = chapterId;
            }
            if (normalized == "payoff" || normalized.Contains("回收") || normalized.Contains("揭"))
            {
                entry.IsResolved = true;
                entry.ActualPayoffChapter = chapterId;
            }
        }
    }

    private Task ApplyPlotPointsAsync(string projectId, string? sourceBookId, string chapterId, List<ParsedPlotPointChange> changes, CancellationToken ct)
    {
        foreach (var change in changes)
        {
            _db.PlotPoints.Add(new PlotPoint
            {
                ProjectId = projectId,
                SourceBookId = sourceBookId,
                ChapterId = chapterId,
                Context = change.Context,
                Keywords = change.Keywords,
                InvolvedCharacters = change.InvolvedCharacters,
                Importance = FirstNonEmpty(change.Importance, "normal"),
                Storyline = FirstNonEmpty(change.Storyline, "main")
            });
        }
        return Task.CompletedTask;
    }

    private async Task ApplyLocationChangesAsync(string projectId, string? sourceBookId, string chapterId, List<ParsedLocationStateChange> changes, CancellationToken ct)
    {
        foreach (var change in changes.Where(x => !string.IsNullOrWhiteSpace(x.LocationId)))
        {
            var entry = await _db.LocationStateEntries.FirstOrDefaultAsync(x => x.ProjectId == projectId && x.LocationId == change.LocationId, ct);
            if (entry == null)
            {
                entry = new LocationStateEntry { ProjectId = projectId, SourceBookId = sourceBookId, LocationId = change.LocationId, Name = change.LocationId };
                _db.LocationStateEntries.Add(entry);
            }
            entry.CurrentStatus = FirstNonEmpty(change.NewStatus, entry.CurrentStatus);
            _db.LocationStatePoints.Add(new LocationStatePoint
            {
                LocationStateEntryId = entry.Id,
                ChapterId = chapterId,
                Status = change.NewStatus,
                Event = change.Event,
                Importance = FirstNonEmpty(change.Importance, "normal")
            });
        }
    }

    private async Task ApplyFactionChangesAsync(string projectId, string? sourceBookId, string chapterId, List<ParsedFactionStateChange> changes, CancellationToken ct)
    {
        foreach (var change in changes.Where(x => !string.IsNullOrWhiteSpace(x.FactionId)))
        {
            var entry = await _db.FactionStateEntries.FirstOrDefaultAsync(x => x.ProjectId == projectId && x.FactionId == change.FactionId, ct);
            if (entry == null)
            {
                entry = new FactionStateEntry { ProjectId = projectId, SourceBookId = sourceBookId, FactionId = change.FactionId, Name = change.FactionId };
                _db.FactionStateEntries.Add(entry);
            }
            entry.CurrentStatus = FirstNonEmpty(change.NewStatus, entry.CurrentStatus);
            _db.FactionStatePoints.Add(new FactionStatePoint
            {
                FactionStateEntryId = entry.Id,
                ChapterId = chapterId,
                Status = change.NewStatus,
                Event = change.Event,
                Importance = FirstNonEmpty(change.Importance, "normal")
            });
        }
    }

    private async Task ApplyTimelineAsync(string projectId, string? sourceBookId, string chapterId, ParsedTimeProgressionChange? change, CancellationToken ct)
    {
        if (change == null) return;
        var existing = await _db.ChapterTimelines.FirstOrDefaultAsync(x => x.ProjectId == projectId && x.ChapterId == chapterId, ct);
        if (existing == null)
        {
            existing = new ChapterTimeline { ProjectId = projectId, SourceBookId = sourceBookId, ChapterId = chapterId };
            _db.ChapterTimelines.Add(existing);
        }
        existing.TimePeriod = change.TimePeriod;
        existing.ElapsedTime = change.ElapsedTime;
        existing.KeyTimeEvent = change.KeyTimeEvent;
        existing.Importance = FirstNonEmpty(change.Importance, "normal");
    }

    private async Task ApplyMovementsAsync(string projectId, string? sourceBookId, string chapterId, List<ParsedCharacterMovementChange> changes, CancellationToken ct)
    {
        foreach (var change in changes.Where(x => !string.IsNullOrWhiteSpace(x.CharacterId)))
        {
            _db.CharacterMovements.Add(new CharacterMovement
            {
                ProjectId = projectId,
                SourceBookId = sourceBookId,
                ChapterId = chapterId,
                CharacterName = change.CharacterId,
                FromLocation = change.FromLocation,
                ToLocation = change.ToLocation,
                Importance = FirstNonEmpty(change.Importance, "normal")
            });

            var location = await _db.CharacterLocations.FirstOrDefaultAsync(x => x.ProjectId == projectId && x.CharacterName == change.CharacterId, ct);
            if (location == null)
            {
                location = new CharacterLocation { ProjectId = projectId, SourceBookId = sourceBookId, CharacterName = change.CharacterId };
                _db.CharacterLocations.Add(location);
            }
            location.CurrentLocation = FirstNonEmpty(change.ToLocation, location.CurrentLocation);
            location.LastUpdatedChapter = chapterId;
        }
    }

    private async Task ApplyItemTransfersAsync(string projectId, string? sourceBookId, string chapterId, List<ParsedItemTransferChange> changes, CancellationToken ct)
    {
        foreach (var change in changes.Where(x => !string.IsNullOrWhiteSpace(x.ItemId) || !string.IsNullOrWhiteSpace(x.ItemName)))
        {
            var itemName = FirstNonEmpty(change.ItemName, change.ItemId);
            var entry = await _db.ItemStateEntries.FirstOrDefaultAsync(x => x.ProjectId == projectId && x.Name == itemName, ct);
            if (entry == null)
            {
                entry = new ItemStateEntry { ProjectId = projectId, SourceBookId = sourceBookId, Name = itemName };
                _db.ItemStateEntries.Add(entry);
            }
            entry.CurrentHolder = FirstNonEmpty(change.ToHolder, entry.CurrentHolder);
            entry.CurrentStatus = FirstNonEmpty(change.NewStatus, entry.CurrentStatus);
            _db.ItemStatePoints.Add(new ItemStatePoint
            {
                ItemStateEntryId = entry.Id,
                ChapterId = chapterId,
                Holder = entry.CurrentHolder,
                Status = entry.CurrentStatus,
                Event = change.Event,
                Importance = FirstNonEmpty(change.Importance, "normal")
            });
        }
    }

    private async Task<CharacterStateEntry> GetOrCreateCharacterEntryAsync(string projectId, string? sourceBookId, string characterId, CancellationToken ct)
    {
        var entry = await _db.CharacterStateEntries.FirstOrDefaultAsync(x => x.ProjectId == projectId && x.CharacterId == characterId, ct);
        if (entry != null) return entry;

        entry = new CharacterStateEntry
        {
            ProjectId = projectId,
            SourceBookId = sourceBookId,
            CharacterId = characterId,
            Name = characterId
        };
        _db.CharacterStateEntries.Add(entry);
        return entry;
    }

    private static IQueryable<T> FilterBySourceBook<T>(IQueryable<T> query, string? sourceBookId)
        where T : BusinessDataBase
    {
        return string.IsNullOrWhiteSpace(sourceBookId)
            ? query
            : query.Where(x => x.SourceBookId == sourceBookId);
    }

    private static IQueryable<T> FilterTrackingBySourceBook<T>(IQueryable<T> query, string? sourceBookId)
        where T : class
    {
        return string.IsNullOrWhiteSpace(sourceBookId)
            ? query
            : query.Where(x => EF.Property<string?>(x, "SourceBookId") == sourceBookId);
    }

    private static string FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim() ?? string.Empty;

    private static string? NullIfEmpty(string value)
        => string.IsNullOrWhiteSpace(value) ? null : value;

    private static string JoinNonEmpty(params string?[] values)
        => string.Join("；", values.Where(v => !string.IsNullOrWhiteSpace(v)).Select(v => v!.Trim()));

    private static List<string> SplitTags(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return new List<string>();

        return value
            .Split(new[] { '、', ',', '，', ';', '；', '\n', '\r', '|', '/' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(x => x.Trim())
            .Where(x => x.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static List<string> SplitRuleLines(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return new List<string>();

        return value
            .Split(new[] { '\n', '\r', ';', '；' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(x => x.Trim().TrimStart('-', '*', '•').Trim())
            .Where(x => x.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static void Deduplicate(List<string> values)
    {
        var deduped = values
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        values.Clear();
        values.AddRange(deduped);
    }

    private sealed class ParsedChapterChanges
    {
        public List<ParsedCharacterStateChange> CharacterStateChanges { get; set; } = new();
        public List<ParsedConflictProgressChange> ConflictProgress { get; set; } = new();
        public List<ParsedPlotPointChange> NewPlotPoints { get; set; } = new();
        public List<ParsedForeshadowingAction> ForeshadowingActions { get; set; } = new();
        public List<ParsedLocationStateChange> LocationStateChanges { get; set; } = new();
        public List<ParsedFactionStateChange> FactionStateChanges { get; set; } = new();
        public ParsedTimeProgressionChange? TimeProgression { get; set; }
        public List<ParsedCharacterMovementChange> CharacterMovements { get; set; } = new();
        public List<ParsedItemTransferChange> ItemTransfers { get; set; } = new();
    }

    private sealed class ParsedCharacterStateChange
    {
        public string CharacterId { get; set; } = string.Empty;
        public string NewLevel { get; set; } = string.Empty;
        public List<string> NewAbilities { get; set; } = new();
        public List<string> LostAbilities { get; set; } = new();
        public Dictionary<string, ParsedRelationshipChange> RelationshipChanges { get; set; } = new();
        public string NewMentalState { get; set; } = string.Empty;
        public string KeyEvent { get; set; } = string.Empty;
        public string Importance { get; set; } = "normal";
    }

    private sealed class ParsedRelationshipChange
    {
        public string Relation { get; set; } = string.Empty;
        public int TrustDelta { get; set; }
    }

    private sealed class ParsedConflictProgressChange
    {
        public string ConflictId { get; set; } = string.Empty;
        public string NewStatus { get; set; } = string.Empty;
        public string Event { get; set; } = string.Empty;
        public string Importance { get; set; } = "normal";
    }

    private sealed class ParsedPlotPointChange
    {
        public List<string> Keywords { get; set; } = new();
        public string Context { get; set; } = string.Empty;
        public List<string> InvolvedCharacters { get; set; } = new();
        public string Importance { get; set; } = "normal";
        public string Storyline { get; set; } = "main";
    }

    private sealed class ParsedForeshadowingAction
    {
        public string ForeshadowId { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
    }

    private sealed class ParsedLocationStateChange
    {
        public string LocationId { get; set; } = string.Empty;
        public string NewStatus { get; set; } = string.Empty;
        public string Event { get; set; } = string.Empty;
        public string Importance { get; set; } = "normal";
    }

    private sealed class ParsedFactionStateChange
    {
        public string FactionId { get; set; } = string.Empty;
        public string NewStatus { get; set; } = string.Empty;
        public string Event { get; set; } = string.Empty;
        public string Importance { get; set; } = "normal";
    }

    private sealed class ParsedTimeProgressionChange
    {
        public string TimePeriod { get; set; } = string.Empty;
        public string ElapsedTime { get; set; } = string.Empty;
        public string KeyTimeEvent { get; set; } = string.Empty;
        public string Importance { get; set; } = "normal";
    }

    private sealed class ParsedCharacterMovementChange
    {
        public string CharacterId { get; set; } = string.Empty;
        public string FromLocation { get; set; } = string.Empty;
        public string ToLocation { get; set; } = string.Empty;
        public string Importance { get; set; } = "normal";
    }

    private sealed class ParsedItemTransferChange
    {
        public string ItemId { get; set; } = string.Empty;
        public string ItemName { get; set; } = string.Empty;
        public string FromHolder { get; set; } = string.Empty;
        public string ToHolder { get; set; } = string.Empty;
        public string NewStatus { get; set; } = "active";
        public string Event { get; set; } = string.Empty;
        public string Importance { get; set; } = "normal";
    }
}
