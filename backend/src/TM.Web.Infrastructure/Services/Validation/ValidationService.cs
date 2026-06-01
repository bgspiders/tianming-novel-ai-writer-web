using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Validation;
using TM.Web.Application.Services;
using TM.Web.Domain.Common;
using TM.Web.Domain.Entities.Core;
using TM.Web.Domain.Entities.Design;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Domain.Entities.Tracking;
using TM.Web.Domain.Entities.Validation;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Validation;

public sealed class ValidationService : IValidationService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly HashSet<string> AllowedChapterStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "planned",
        "blueprinted",
        "drafted",
        "needs_fix",
        "validated",
        "archived"
    };

    private sealed record FactStateSnapshot<TEntry, TPoint>(TEntry Entry, IReadOnlyList<TPoint> Points);
    private sealed record ValidationRuleContext(
        IReadOnlyDictionary<int, IReadOnlyList<ChapterPlan>> PlansByChapterNumber,
        IReadOnlyDictionary<string, IReadOnlyList<ChapterBlueprint>> BlueprintsByChapterId,
        IReadOnlySet<string> CharacterNames,
        IReadOnlySet<string> FactionNames,
        IReadOnlySet<string> LocationNames,
        IReadOnlyDictionary<string, IReadOnlyList<Foreshadowing>> ForeshadowingsByChapterMarker,
        IReadOnlyDictionary<string, IReadOnlyList<ChapterTimeline>> TimelinesByChapterId,
        IReadOnlyDictionary<string, IReadOnlyList<CharacterMovement>> MovementsByChapterId,
        IReadOnlyDictionary<string, IReadOnlyList<PlotPoint>> PlotPointsByChapterId);

    private readonly AppDbContext _db;

    public ValidationService(AppDbContext db) => _db = db;

    public async Task<ValidationSummaryDto> RunAsync(ValidationRunRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.ProjectId))
        {
            throw new ArgumentException("项目 ID 不能为空。", nameof(request.ProjectId));
        }

        var projectExists = await _db.Projects.AsNoTracking().AnyAsync(p => p.Id == request.ProjectId, ct);
        if (!projectExists)
        {
            throw new KeyNotFoundException($"项目不存在：{request.ProjectId}");
        }

        var targetVolumeNumber = request.VolumeNumber.GetValueOrDefault(0);
        var now = DateTime.UtcNow;
        var runId = $"val_{now:yyyyMMddHHmmssfff}_{Guid.NewGuid():N}"[..31];
        var chaptersQuery = _db.Chapters.AsNoTracking().Where(c => c.ProjectId == request.ProjectId);

        if (targetVolumeNumber > 0)
        {
            var volume = await _db.Volumes.AsNoTracking()
                .FirstOrDefaultAsync(v => v.ProjectId == request.ProjectId && v.VolumeNumber == targetVolumeNumber, ct);
            if (volume == null)
            {
                throw new KeyNotFoundException($"分卷不存在：project={request.ProjectId}, volume={targetVolumeNumber}");
            }
            chaptersQuery = chaptersQuery.Where(c => c.VolumeId == volume.Id);
        }

        var chapters = await chaptersQuery
            .OrderBy(c => c.ChapterNumber)
            .ToListAsync(ct);
        var ruleContext = await BuildRuleContextAsync(request.ProjectId, chapters, ct);

        var reports = new List<ValidationReport>();
        foreach (var chapter in chapters)
        {
            reports.Add(BuildChapterReport(request.ProjectId, runId, chapter, now, ruleContext));
        }

        if (reports.Count > 0)
        {
            _db.ValidationReports.AddRange(reports);
        }

        var moduleResults = BuildModuleResults(chapters, reports, now);
        var problemItems = reports
            .SelectMany(r => r.Items.Select(i => new
            {
                r.ChapterId,
                i.ValidationType,
                i.Name,
                i.Result,
                i.Details,
                i.Suggestion
            }))
            .Where(x => x.Result != "passed")
            .ToList();

        var overallResult = ResolveOverallResult(problemItems.Select(x => x.Result));
        var summary = await _db.ValidationSummaries
            .FirstOrDefaultAsync(s => s.ProjectId == request.ProjectId && s.TargetVolumeNumber == targetVolumeNumber, ct);

        if (summary == null)
        {
            summary = new ValidationSummary
            {
                ProjectId = request.ProjectId,
                TargetVolumeNumber = targetVolumeNumber
            };
            _db.ValidationSummaries.Add(summary);
        }

        summary.OverallResult = overallResult;
        summary.LastRunId = runId;
        summary.ModuleResults = JsonSerializer.Serialize(moduleResults, JsonOptions);
        summary.ProblemItems = JsonSerializer.Serialize(problemItems, JsonOptions);
        summary.LastValidatedAt = now;

        await _db.SaveChangesAsync(ct);
        return ToDto(summary);
    }

    public async Task<IReadOnlyList<ValidationSummaryDto>> ListSummariesAsync(
        string projectId,
        int? volumeNumber = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(projectId)) return Array.Empty<ValidationSummaryDto>();

        var q = _db.ValidationSummaries.AsNoTracking().Where(s => s.ProjectId == projectId);
        if (volumeNumber.HasValue) q = q.Where(s => s.TargetVolumeNumber == volumeNumber.Value);

        var rows = await q
            .OrderByDescending(s => s.LastValidatedAt)
            .ThenBy(s => s.TargetVolumeNumber)
            .ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    public async Task<IReadOnlyList<ValidationReportDto>> ListReportsAsync(
        string projectId,
        int? volumeNumber = null,
        string? chapterId = null,
        int take = 100,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(projectId)) return Array.Empty<ValidationReportDto>();

        take = Math.Clamp(take, 1, 500);
        var q = _db.ValidationReports
            .AsNoTracking()
            .Include(r => r.Items)
            .Where(r => r.ProjectId == projectId);

        if (!string.IsNullOrWhiteSpace(chapterId))
        {
            q = q.Where(r => r.ChapterId == chapterId);
        }

        if (volumeNumber.HasValue && volumeNumber.Value > 0)
        {
            var volumeIds = _db.Volumes
                .Where(v => v.ProjectId == projectId && v.VolumeNumber == volumeNumber.Value)
                .Select(v => v.Id);
            var chapterIds = _db.Chapters
                .Where(c => c.ProjectId == projectId && volumeIds.Contains(c.VolumeId))
                .Select(c => c.Id);
            q = q.Where(r => chapterIds.Contains(r.ChapterId));
        }

        if (string.IsNullOrWhiteSpace(chapterId))
        {
            var targetVolumeNumber = volumeNumber.GetValueOrDefault(0);
            var latestRunId = await _db.ValidationSummaries.AsNoTracking()
                .Where(s => s.ProjectId == projectId && s.TargetVolumeNumber == targetVolumeNumber)
                .OrderByDescending(s => s.LastValidatedAt)
                .Select(s => s.LastRunId)
                .FirstOrDefaultAsync(ct);
            if (!string.IsNullOrWhiteSpace(latestRunId))
            {
                q = q.Where(r => r.RunId == latestRunId);
            }
        }

        var rows = await q
            .OrderByDescending(r => r.ValidatedAt)
            .Take(take)
            .ToListAsync(ct);

        var chapterMap = await _db.Chapters.AsNoTracking()
            .Where(c => c.ProjectId == projectId && rows.Select(r => r.ChapterId).Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, ct);

        return rows.Select(r => ToDto(r, chapterMap.GetValueOrDefault(r.ChapterId))).ToList();
    }

    public async Task<ValidationReportStatusUpdateResult> UpdateReportChapterStatusAsync(
        string reportId,
        ValidationReportStatusUpdateRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(reportId))
        {
            throw new ArgumentException("校验报告 ID 不能为空。", nameof(reportId));
        }

        var status = NormalizeChapterStatus(request.Status);
        var report = await _db.ValidationReports.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == reportId, ct)
            ?? throw new KeyNotFoundException($"校验报告不存在：{reportId}");

        var chapter = await _db.Chapters
            .FirstOrDefaultAsync(c => c.Id == report.ChapterId && c.ProjectId == report.ProjectId, ct)
            ?? throw new KeyNotFoundException($"校验报告关联章节不存在：{report.ChapterId}");

        chapter.Status = status;
        await _db.SaveChangesAsync(ct);

        return new ValidationReportStatusUpdateResult(
            report.Id,
            report.ProjectId,
            chapter.Id,
            chapter.Status,
            string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
            chapter.UpdatedAt);
    }

    public async Task<FactSnapshotDto> GetFactSnapshotAsync(
        string projectId,
        int? volumeNumber = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(projectId))
        {
            return new FactSnapshotDto(
                string.Empty,
                volumeNumber,
                EmptyFactOverview(),
                Array.Empty<FactSnapshotSectionDto>(),
                Array.Empty<FactTimelineDto>(),
                Array.Empty<VolumeFactArchiveDto>());
        }

        var chapterQuery = _db.Chapters.AsNoTracking().Where(c => c.ProjectId == projectId);
        if (volumeNumber.HasValue && volumeNumber.Value > 0)
        {
            var volumeIds = _db.Volumes
                .Where(v => v.ProjectId == projectId && v.VolumeNumber == volumeNumber.Value)
                .Select(v => v.Id);
            chapterQuery = chapterQuery.Where(c => volumeIds.Contains(c.VolumeId));
        }

        var chapters = await chapterQuery.ToDictionaryAsync(c => c.Id, ct);
        var chapterIds = chapters.Keys.ToList();

        var project = await _db.Projects.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == projectId, ct);
        var sourceBookId = project?.CurrentSourceBookId;

        var timelineRows = await FilterTrackingBySourceBook(
                _db.ChapterTimelines.AsNoTracking().Where(t => t.ProjectId == projectId && chapterIds.Contains(t.ChapterId)),
                sourceBookId)
            .ToListAsync(ct);

        var timelines = timelineRows
            .Where(t => chapters.ContainsKey(t.ChapterId))
            .OrderBy(t => chapters[t.ChapterId].ChapterNumber)
            .Select(t => new FactTimelineDto(
                t.Id,
                t.ChapterId,
                chapters[t.ChapterId].ChapterNumber,
                chapters[t.ChapterId].Title,
                t.TimePeriod,
                t.ElapsedTime,
                t.KeyTimeEvent,
                t.Importance))
            .ToList();

        var archivesQuery = _db.VolumeFactArchives.AsNoTracking().Where(a => a.ProjectId == projectId);
        if (volumeNumber.HasValue && volumeNumber.Value > 0)
        {
            archivesQuery = archivesQuery.Where(a => a.VolumeNumber == volumeNumber.Value);
        }

        var archives = await archivesQuery
            .OrderByDescending(a => a.ArchivedAt)
            .Select(a => new VolumeFactArchiveDto(
                a.Id,
                a.VolumeId,
                a.VolumeNumber,
                a.LastChapterId,
                a.ArchivedAt,
                a.SnapshotPayload))
            .ToListAsync(ct);

        var characterRules = await FilterBusinessBySourceBook(
                _db.CharacterRules.AsNoTracking().Where(x => x.IsEnabled),
                sourceBookId)
            .ToListAsync(ct);

        var locationRules = await FilterBusinessBySourceBook(
                _db.LocationRules.AsNoTracking().Where(x => x.IsEnabled),
                sourceBookId)
            .ToListAsync(ct);

        var worldRules = await FilterBusinessBySourceBook(
                _db.WorldRules.AsNoTracking().Where(x => x.IsEnabled),
                sourceBookId)
            .ToListAsync(ct);

        var characterEntries = await FilterTrackingBySourceBook(
                _db.CharacterStateEntries.AsNoTracking()
                    .Include(e => e.StateHistory)
                    .Where(e => e.ProjectId == projectId),
                sourceBookId)
            .ToListAsync(ct);
        var characterSnapshots = characterEntries
            .Select(e => new FactStateSnapshot<CharacterStateEntry, CharacterStatePoint>(
                e,
                e.StateHistory.Where(p => chapterIds.Contains(p.ChapterId)).ToList()))
            .Where(x => !volumeNumber.HasValue || volumeNumber.Value <= 0 || x.Points.Count > 0)
            .ToList();

        var conflictEntries = await FilterTrackingBySourceBook(
                _db.ConflictProgressEntries.AsNoTracking()
                    .Include(e => e.ProgressPoints)
                    .Where(e => e.ProjectId == projectId),
                sourceBookId)
            .ToListAsync(ct);
        var conflictSnapshots = conflictEntries
            .Select(e => new FactStateSnapshot<ConflictProgressEntry, ConflictProgressPoint>(
                e,
                e.ProgressPoints.Where(p => chapterIds.Contains(p.ChapterId)).ToList()))
            .Where(x => !volumeNumber.HasValue || volumeNumber.Value <= 0 || x.Points.Count > 0)
            .ToList();

        var factionEntries = await FilterTrackingBySourceBook(
                _db.FactionStateEntries.AsNoTracking()
                    .Include(e => e.StateHistory)
                    .Where(e => e.ProjectId == projectId),
                sourceBookId)
            .ToListAsync(ct);
        var factionSnapshots = factionEntries
            .Select(e => new FactStateSnapshot<FactionStateEntry, FactionStatePoint>(
                e,
                e.StateHistory.Where(p => chapterIds.Contains(p.ChapterId)).ToList()))
            .Where(x => !volumeNumber.HasValue || volumeNumber.Value <= 0 || x.Points.Count > 0)
            .ToList();

        var locationEntries = await FilterTrackingBySourceBook(
                _db.LocationStateEntries.AsNoTracking()
                    .Include(e => e.StateHistory)
                    .Where(e => e.ProjectId == projectId),
                sourceBookId)
            .ToListAsync(ct);
        var locationSnapshots = locationEntries
            .Select(e => new FactStateSnapshot<LocationStateEntry, LocationStatePoint>(
                e,
                e.StateHistory.Where(p => chapterIds.Contains(p.ChapterId)).ToList()))
            .Where(x => !volumeNumber.HasValue || volumeNumber.Value <= 0 || x.Points.Count > 0)
            .ToList();

        var characterLocations = await FilterTrackingBySourceBook(
                _db.CharacterLocations.AsNoTracking().Where(x => x.ProjectId == projectId),
                sourceBookId)
            .ToListAsync(ct);

        var characterMovements = await FilterTrackingBySourceBook(
                _db.CharacterMovements.AsNoTracking().Where(x => x.ProjectId == projectId && chapterIds.Contains(x.ChapterId)),
                sourceBookId)
            .ToListAsync(ct);

        var itemEntries = await FilterTrackingBySourceBook(
                _db.ItemStateEntries.AsNoTracking()
                    .Include(e => e.StateHistory)
                    .Where(e => e.ProjectId == projectId),
                sourceBookId)
            .ToListAsync(ct);
        var itemSnapshots = itemEntries
            .Select(e => new FactStateSnapshot<ItemStateEntry, ItemStatePoint>(
                e,
                e.StateHistory.Where(p => chapterIds.Contains(p.ChapterId)).ToList()))
            .Where(x => !volumeNumber.HasValue || volumeNumber.Value <= 0 || x.Points.Count > 0)
            .ToList();

        var foreshadowings = await FilterTrackingBySourceBook(
                _db.Foreshadowings.AsNoTracking().Where(f => f.ProjectId == projectId),
                sourceBookId)
            .OrderBy(f => f.IsResolved)
            .ThenByDescending(f => f.IsOverdue)
            .ThenBy(f => f.Tier)
            .ThenBy(f => f.Name)
            .ToListAsync(ct);

        var plotPoints = await FilterTrackingBySourceBook(
                _db.PlotPoints.AsNoTracking().Where(p => p.ProjectId == projectId && chapterIds.Contains(p.ChapterId)),
                sourceBookId)
            .ToListAsync(ct);

        var overview = new FactSnapshotOverviewDto(
            chapters.Count,
            timelines.Count,
            characterSnapshots.Count,
            characterSnapshots.Sum(x => x.Points.Count),
            characterRules.Count,
            conflictSnapshots.Count,
            conflictSnapshots.Sum(x => x.Points.Count),
            factionSnapshots.Count,
            factionSnapshots.Sum(x => x.Points.Count),
            locationSnapshots.Count,
            locationSnapshots.Sum(x => x.Points.Count),
            locationRules.Count,
            worldRules.Sum(CountWorldRuleConstraints),
            characterLocations.Count,
            characterMovements.Count,
            itemSnapshots.Count,
            itemSnapshots.Sum(x => x.Points.Count),
            foreshadowings.Count,
            foreshadowings.Count(f => !f.IsResolved),
            foreshadowings.Count(f => f.IsOverdue),
            plotPoints.Count,
            archives.Count);

        var sections = new[]
        {
            BuildCharacterSection(characterSnapshots, chapters),
            BuildCharacterDescriptionSection(characterRules),
            BuildConflictSection(conflictSnapshots, chapters),
            BuildFactionSection(factionSnapshots, chapters),
            BuildLocationSection(locationSnapshots, chapters),
            BuildLocationDescriptionSection(locationRules),
            BuildWorldRuleSection(worldRules),
            BuildCharacterLocationSection(characterLocations, characterMovements, chapters),
            BuildItemSection(itemSnapshots, chapters),
            BuildForeshadowingSection(foreshadowings),
            BuildTimelineSection(timelines),
            BuildPlotPointSection(plotPoints, chapters)
        };

        return new FactSnapshotDto(projectId, volumeNumber, overview, sections, timelines, archives);
    }

    private static FactSnapshotOverviewDto EmptyFactOverview()
        => new(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

    private static FactSnapshotSectionDto BuildCharacterSection(
        IReadOnlyList<FactStateSnapshot<CharacterStateEntry, CharacterStatePoint>> snapshots,
        IReadOnlyDictionary<string, Chapter> chapters)
    {
        var items = snapshots
            .Select(x =>
            {
                var latest = LatestByChapter(x.Points, chapters);
                return new FactSnapshotItemDto(
                    x.Entry.CharacterId,
                    FirstNonEmpty(x.Entry.Name, x.Entry.CharacterId),
                    FirstNonEmpty(latest?.Phase, latest?.Level, "未记录状态"),
                    JoinNonEmpty(latest?.MentalState, latest?.KeyEvent),
                    latest != null && chapters.TryGetValue(latest.ChapterId, out var chapter) ? chapter.ChapterNumber : null,
                    latest?.Importance ?? string.Empty);
            })
            .OrderBy(i => i.ChapterNumber ?? int.MaxValue)
            .ThenBy(i => i.Name)
            .Take(12)
            .ToList();

        return new FactSnapshotSectionDto(
            "characterStates",
            "角色状态",
            snapshots.Count,
            snapshots.Count == 0 ? "暂无角色状态记录。" : $"已追踪 {snapshots.Count} 个角色，累计 {snapshots.Sum(x => x.Points.Count)} 条状态点。",
            items);
    }

    private static FactSnapshotSectionDto BuildCharacterDescriptionSection(IReadOnlyList<CharacterRule> rows)
    {
        var items = rows
            .OrderBy(x => x.Name)
            .Take(12)
            .Select(x => new FactSnapshotItemDto(
                x.Id,
                FirstNonEmpty(x.Name, x.Id),
                FirstNonEmpty(x.CharacterType, x.Identity, "角色规则"),
                JoinNonEmpty(x.Appearance, x.GrowthPath, x.SpecialAbilities),
                null,
                x.IsEnabled ? "enabled" : "disabled"))
            .ToList();

        return new FactSnapshotSectionDto(
            "characterDescriptions",
            "角色设定",
            rows.Count,
            rows.Count == 0 ? "暂无角色设定记录。" : $"当前源书可用角色设定 {rows.Count} 条。",
            items);
    }

    private static FactSnapshotSectionDto BuildConflictSection(
        IReadOnlyList<FactStateSnapshot<ConflictProgressEntry, ConflictProgressPoint>> snapshots,
        IReadOnlyDictionary<string, Chapter> chapters)
    {
        var items = snapshots
            .Select(x =>
            {
                var latest = LatestByChapter(x.Points, chapters);
                return new FactSnapshotItemDto(
                    x.Entry.Id,
                    FirstNonEmpty(x.Entry.Name, x.Entry.Id),
                    FirstNonEmpty(latest?.Status, x.Entry.Status),
                    FirstNonEmpty(latest?.Event, latest?.Description, JoinNonEmpty(x.Entry.Type, x.Entry.Tier)),
                    latest != null && chapters.TryGetValue(latest.ChapterId, out var chapter) ? chapter.ChapterNumber : null,
                    FirstNonEmpty(latest?.Importance, x.Entry.Tier));
            })
            .OrderBy(i => i.ChapterNumber ?? int.MaxValue)
            .ThenBy(i => i.Name)
            .Take(12)
            .ToList();

        return new FactSnapshotSectionDto(
            "conflictProgress",
            "冲突进度",
            snapshots.Count,
            snapshots.Count == 0 ? "暂无冲突进度记录。" : $"已追踪 {snapshots.Count} 条冲突线，累计 {snapshots.Sum(x => x.Points.Count)} 条推进点。",
            items);
    }

    private static FactSnapshotSectionDto BuildFactionSection(
        IReadOnlyList<FactStateSnapshot<FactionStateEntry, FactionStatePoint>> snapshots,
        IReadOnlyDictionary<string, Chapter> chapters)
    {
        var items = snapshots
            .Select(x =>
            {
                var latest = LatestByChapter(x.Points, chapters);
                return new FactSnapshotItemDto(
                    x.Entry.FactionId,
                    FirstNonEmpty(x.Entry.Name, x.Entry.FactionId),
                    FirstNonEmpty(latest?.Status, x.Entry.CurrentStatus),
                    latest?.Event ?? string.Empty,
                    latest != null && chapters.TryGetValue(latest.ChapterId, out var chapter) ? chapter.ChapterNumber : null,
                    latest?.Importance ?? string.Empty);
            })
            .OrderBy(i => i.ChapterNumber ?? int.MaxValue)
            .ThenBy(i => i.Name)
            .Take(12)
            .ToList();

        return new FactSnapshotSectionDto(
            "factionStates",
            "势力状态",
            snapshots.Count,
            snapshots.Count == 0 ? "暂无势力状态记录。" : $"已追踪 {snapshots.Count} 个势力，累计 {snapshots.Sum(x => x.Points.Count)} 条状态点。",
            items);
    }

    private static FactSnapshotSectionDto BuildLocationSection(
        IReadOnlyList<FactStateSnapshot<LocationStateEntry, LocationStatePoint>> snapshots,
        IReadOnlyDictionary<string, Chapter> chapters)
    {
        var items = snapshots
            .Select(x =>
            {
                var latest = LatestByChapter(x.Points, chapters);
                return new FactSnapshotItemDto(
                    x.Entry.LocationId,
                    FirstNonEmpty(x.Entry.Name, x.Entry.LocationId),
                    FirstNonEmpty(latest?.Status, x.Entry.CurrentStatus),
                    latest?.Event ?? string.Empty,
                    latest != null && chapters.TryGetValue(latest.ChapterId, out var chapter) ? chapter.ChapterNumber : null,
                    latest?.Importance ?? string.Empty);
            })
            .OrderBy(i => i.ChapterNumber ?? int.MaxValue)
            .ThenBy(i => i.Name)
            .Take(12)
            .ToList();

        return new FactSnapshotSectionDto(
            "locationStates",
            "地点状态",
            snapshots.Count,
            snapshots.Count == 0 ? "暂无地点状态记录。" : $"已追踪 {snapshots.Count} 个地点，累计 {snapshots.Sum(x => x.Points.Count)} 条状态点。",
            items);
    }

    private static FactSnapshotSectionDto BuildLocationDescriptionSection(IReadOnlyList<LocationRule> rows)
    {
        var items = rows
            .OrderBy(x => x.Name)
            .Take(12)
            .Select(x => new FactSnapshotItemDto(
                x.Id,
                FirstNonEmpty(x.Name, x.Id),
                FirstNonEmpty(x.LocationType, x.Scale, "地点规则"),
                JoinNonEmpty(x.Description, x.Terrain, x.Climate),
                null,
                x.IsEnabled ? "enabled" : "disabled"))
            .ToList();

        return new FactSnapshotSectionDto(
            "locationDescriptions",
            "地点设定",
            rows.Count,
            rows.Count == 0 ? "暂无地点设定记录。" : $"当前源书可用地点设定 {rows.Count} 条。",
            items);
    }

    private static FactSnapshotSectionDto BuildWorldRuleSection(IReadOnlyList<WorldRule> rows)
    {
        var items = rows
            .OrderBy(x => x.Name)
            .Take(12)
            .Select(x => new FactSnapshotItemDto(
                x.Id,
                FirstNonEmpty(x.Name, x.Id),
                "hard_rules",
                FirstNonEmpty(x.HardRules, x.PowerSystem, x.SpecialLaws, x.OneLineSummary),
                null,
                x.IsEnabled ? "enabled" : "disabled"))
            .ToList();

        var constraintCount = rows.Sum(CountWorldRuleConstraints);
        return new FactSnapshotSectionDto(
            "worldRuleConstraints",
            "世界观硬约束",
            constraintCount,
            constraintCount == 0 ? "暂无世界观硬约束。" : $"从 {rows.Count} 条世界观规则中提取 {constraintCount} 条硬约束/特殊法则。",
            items);
    }

    private static FactSnapshotSectionDto BuildCharacterLocationSection(
        IReadOnlyList<CharacterLocation> locations,
        IReadOnlyList<CharacterMovement> movements,
        IReadOnlyDictionary<string, Chapter> chapters)
    {
        var latestMovementByCharacter = movements
            .GroupBy(m => m.CharacterName)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(m => ChapterNumberOf(m.ChapterId, chapters)).First(),
                StringComparer.OrdinalIgnoreCase);

        var items = locations
            .OrderBy(x => x.CharacterName)
            .Take(12)
            .Select(x =>
            {
                latestMovementByCharacter.TryGetValue(x.CharacterName, out var movement);
                var chapterId = FirstNonEmpty(x.LastUpdatedChapter, movement?.ChapterId);
                return new FactSnapshotItemDto(
                    x.Id,
                    FirstNonEmpty(x.CharacterName, x.Id),
                    FirstNonEmpty(x.CurrentLocation, movement?.ToLocation, "未知位置"),
                    movement == null
                        ? string.Empty
                        : JoinNonEmpty(movement.FromLocation, movement.ToLocation),
                    chapters.TryGetValue(chapterId, out var chapter) ? chapter.ChapterNumber : null,
                    movement?.Importance ?? string.Empty);
            })
            .ToList();

        return new FactSnapshotSectionDto(
            "characterLocations",
            "角色位置",
            locations.Count,
            locations.Count == 0 ? "暂无角色位置记录。" : $"已追踪 {locations.Count} 个角色当前位置，当前范围内有 {movements.Count} 条移动记录。",
            items);
    }

    private static FactSnapshotSectionDto BuildItemSection(
        IReadOnlyList<FactStateSnapshot<ItemStateEntry, ItemStatePoint>> snapshots,
        IReadOnlyDictionary<string, Chapter> chapters)
    {
        var items = snapshots
            .Select(x =>
            {
                var latest = LatestByChapter(x.Points, chapters);
                return new FactSnapshotItemDto(
                    x.Entry.Id,
                    FirstNonEmpty(x.Entry.Name, x.Entry.Id),
                    FirstNonEmpty(latest?.Status, x.Entry.CurrentStatus),
                    FirstNonEmpty(latest?.Event, latest?.Holder, x.Entry.CurrentHolder, x.Entry.Description),
                    latest != null && chapters.TryGetValue(latest.ChapterId, out var chapter) ? chapter.ChapterNumber : null,
                    latest?.Importance ?? string.Empty);
            })
            .OrderBy(i => i.ChapterNumber ?? int.MaxValue)
            .ThenBy(i => i.Name)
            .Take(12)
            .ToList();

        return new FactSnapshotSectionDto(
            "itemStates",
            "物品状态",
            snapshots.Count,
            snapshots.Count == 0 ? "暂无物品状态记录。" : $"已追踪 {snapshots.Count} 个物品，累计 {snapshots.Sum(x => x.Points.Count)} 条状态点。",
            items);
    }

    private static FactSnapshotSectionDto BuildForeshadowingSection(IReadOnlyList<Foreshadowing> rows)
    {
        var items = rows
            .Take(12)
            .Select(f => new FactSnapshotItemDto(
                f.Id,
                FirstNonEmpty(f.Name, f.Id),
                f.IsResolved ? "resolved" : f.IsSetup ? "setup" : "pending",
                FirstNonEmpty(f.OverdueSuggestion, JoinNonEmpty(f.ExpectedSetupChapter, f.ExpectedPayoffChapter)),
                null,
                f.Tier))
            .ToList();

        return new FactSnapshotSectionDto(
            "foreshadowings",
            "伏笔",
            rows.Count,
            rows.Count == 0 ? "暂无伏笔记录。" : $"共 {rows.Count} 条伏笔，未回收 {rows.Count(f => !f.IsResolved)} 条，逾期 {rows.Count(f => f.IsOverdue)} 条。",
            items);
    }

    private static FactSnapshotSectionDto BuildTimelineSection(IReadOnlyList<FactTimelineDto> rows)
    {
        var items = rows
            .Take(12)
            .Select(t => new FactSnapshotItemDto(
                t.Id,
                FirstNonEmpty(t.ChapterTitle, t.ChapterId),
                FirstNonEmpty(t.TimePeriod, t.ElapsedTime, "时间推进"),
                t.KeyTimeEvent,
                t.ChapterNumber,
                t.Importance))
            .ToList();

        return new FactSnapshotSectionDto(
            "timeline",
            "时间线",
            rows.Count,
            rows.Count == 0 ? "暂无章节时间线记录。" : $"当前范围内有 {rows.Count} 条章节时间推进记录。",
            items);
    }

    private static FactSnapshotSectionDto BuildPlotPointSection(
        IReadOnlyList<PlotPoint> rows,
        IReadOnlyDictionary<string, Chapter> chapters)
    {
        var items = rows
            .OrderBy(p => chapters.TryGetValue(p.ChapterId, out var chapter) ? chapter.ChapterNumber : int.MaxValue)
            .ThenBy(p => p.Storyline)
            .Take(12)
            .Select(p => new FactSnapshotItemDto(
                p.Id,
                FirstNonEmpty(p.Storyline, "剧情节点"),
                p.Importance,
                FirstNonEmpty(p.Context, string.Join("、", p.Keywords)),
                chapters.TryGetValue(p.ChapterId, out var chapter) ? chapter.ChapterNumber : null,
                p.Importance))
            .ToList();

        return new FactSnapshotSectionDto(
            "plotPoints",
            "情节点",
            rows.Count,
            rows.Count == 0 ? "暂无情节点记录。" : $"当前范围内共 {rows.Count} 个情节点，覆盖 {rows.Select(p => p.ChapterId).Distinct().Count()} 个章节。",
            items);
    }

    private static CharacterStatePoint? LatestByChapter(IEnumerable<CharacterStatePoint> points, IReadOnlyDictionary<string, Chapter> chapters)
        => points.OrderByDescending(p => ChapterNumberOf(p.ChapterId, chapters)).FirstOrDefault();

    private static FactionStatePoint? LatestByChapter(IEnumerable<FactionStatePoint> points, IReadOnlyDictionary<string, Chapter> chapters)
        => points.OrderByDescending(p => ChapterNumberOf(p.ChapterId, chapters)).FirstOrDefault();

    private static LocationStatePoint? LatestByChapter(IEnumerable<LocationStatePoint> points, IReadOnlyDictionary<string, Chapter> chapters)
        => points.OrderByDescending(p => ChapterNumberOf(p.ChapterId, chapters)).FirstOrDefault();

    private static ConflictProgressPoint? LatestByChapter(IEnumerable<ConflictProgressPoint> points, IReadOnlyDictionary<string, Chapter> chapters)
        => points.OrderByDescending(p => ChapterNumberOf(p.ChapterId, chapters)).FirstOrDefault();

    private static ItemStatePoint? LatestByChapter(IEnumerable<ItemStatePoint> points, IReadOnlyDictionary<string, Chapter> chapters)
        => points.OrderByDescending(p => ChapterNumberOf(p.ChapterId, chapters)).FirstOrDefault();

    private static int ChapterNumberOf(string chapterId, IReadOnlyDictionary<string, Chapter> chapters)
        => chapters.TryGetValue(chapterId, out var chapter) ? chapter.ChapterNumber : 0;

    private static IQueryable<T> FilterBusinessBySourceBook<T>(IQueryable<T> query, string? sourceBookId)
        where T : BusinessDataBase
        => string.IsNullOrWhiteSpace(sourceBookId) ? query : query.Where(x => x.SourceBookId == sourceBookId);

    private static IQueryable<T> FilterTrackingBySourceBook<T>(IQueryable<T> query, string? sourceBookId)
        where T : class
        => string.IsNullOrWhiteSpace(sourceBookId) ? query : query.Where(x => EF.Property<string?>(x, "SourceBookId") == sourceBookId);

    private static int CountWorldRuleConstraints(WorldRule row)
        => SplitFactLines(row.HardRules).Count + SplitFactLines(row.SpecialLaws).Count;

    private static IReadOnlyList<string> SplitFactLines(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return Array.Empty<string>();
        return value
            .Split(new[] { '\n', '\r', ';', '；', '。' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(x => x.Trim().TrimStart('-', '*').Trim())
            .Where(x => x.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static string FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v)) ?? string.Empty;

    private static string JoinNonEmpty(params string?[] values)
        => string.Join(" / ", values.Where(v => !string.IsNullOrWhiteSpace(v)));

    private static IReadOnlyList<string> SplitNames(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return Array.Empty<string>();
        return value
            .Split(new[] { '、', ',', '，', ';', '；', '\n', '\r', '|', '/', ' ' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(x => x.Trim())
            .Where(x => x.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static bool LooksLikePlaceholder(string value)
        => string.IsNullOrWhiteSpace(value)
           || value is "-" or "无" or "暂无" or "待定" or "未知"
           || value.Contains("无明确", StringComparison.OrdinalIgnoreCase);

    private static ValidationReport BuildChapterReport(
        string projectId,
        string runId,
        Chapter chapter,
        DateTime now,
        ValidationRuleContext context)
    {
        var items = new List<ValidationItem>
        {
            BuildItem(
                "static_consistency",
                "章节标题",
                string.IsNullOrWhiteSpace(chapter.Title) ? "failed" : "passed",
                string.IsNullOrWhiteSpace(chapter.Title) ? "章节标题为空。" : "章节标题已填写。",
                "补齐章节标题后再进入发布/归档。"),
            BuildItem(
                "static_consistency",
                "章节状态",
                ResolveChapterStatusResult(chapter.Status),
                ResolveChapterStatusDetails(chapter.Status),
                "建议保持 planned / blueprinted / drafted / needs_fix / validated / archived 之一。"),
            BuildItem(
                "static_consistency",
                "正文引用",
                string.IsNullOrWhiteSpace(chapter.ContentFilePath) ? "warning" : "passed",
                string.IsNullOrWhiteSpace(chapter.ContentFilePath) ? "未记录正文文件路径。" : $"正文路径：{chapter.ContentFilePath}",
                "生成或导入正文后写入 ContentFilePath。"),
            BuildItem(
                "static_consistency",
                "字数统计",
                chapter.WordCount <= 0 ? "warning" : "passed",
                chapter.WordCount <= 0 ? "字数统计为 0 或未更新。" : $"当前字数：{chapter.WordCount}",
                "保存正文后刷新章节字数。")
        };

        items.AddRange(BuildPlanningItems(chapter, context));
        items.AddRange(BuildReferenceItems(chapter, context));
        items.AddRange(BuildTrackingItems(chapter, context));

        var result = ResolveOverallResult(items.Select(i => i.Result));
        return new ValidationReport
        {
            ProjectId = projectId,
            ChapterId = chapter.Id,
            RunId = runId,
            ValidatedAt = now,
            Result = result,
            Summary = result == "passed" ? "统一校验通过。" : "统一校验发现待处理项。",
            Items = items
        };
    }

    private static IEnumerable<ValidationItem> BuildPlanningItems(Chapter chapter, ValidationRuleContext context)
    {
        context.PlansByChapterNumber.TryGetValue(chapter.ChapterNumber, out var plans);
        context.BlueprintsByChapterId.TryGetValue(chapter.Id, out var blueprints);
        var blueprintList = blueprints ?? Array.Empty<ChapterBlueprint>();

        yield return BuildItem(
            "planning",
            "章节规划",
            plans is { Count: > 0 } ? "passed" : "warning",
            plans is { Count: > 0 } ? $"匹配到 {plans.Count} 条章节规划。" : "未找到匹配章节号的章节规划。",
            "先补齐 ChapterPlan,再进入正文生成/校验。");

        yield return BuildItem(
            "planning",
            "章节蓝图",
            blueprintList.Count > 0 ? "passed" : "warning",
            blueprintList.Count > 0 ? $"匹配到 {blueprintList.Count} 个蓝图场景。" : "未找到当前章节的章节蓝图。",
            "先补齐 ChapterBlueprint 场景,再进入正文生成/校验。");

        var missingPov = blueprintList
            .Where(b => !string.IsNullOrWhiteSpace(b.PovCharacter) && !context.CharacterNames.Contains(b.PovCharacter.Trim()))
            .Select(b => b.PovCharacter.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        yield return BuildItem(
            "reference",
            "蓝图 POV 角色引用",
            missingPov.Count == 0 ? "passed" : "failed",
            missingPov.Count == 0 ? "蓝图 POV 角色均存在于角色规则。" : $"未知 POV 角色：{string.Join("、", missingPov)}",
            "在角色规则中补齐对应角色,或修正蓝图 POV。");
    }

    private static IEnumerable<ValidationItem> BuildReferenceItems(Chapter chapter, ValidationRuleContext context)
    {
        context.PlansByChapterNumber.TryGetValue(chapter.ChapterNumber, out var plans);
        context.BlueprintsByChapterId.TryGetValue(chapter.Id, out var blueprints);

        var referencedCharacters = new List<string>();
        var referencedFactions = new List<string>();
        var referencedLocations = new List<string>();

        foreach (var plan in plans ?? Array.Empty<ChapterPlan>())
        {
            referencedCharacters.AddRange(plan.ReferencedCharacterNames);
            referencedFactions.AddRange(plan.ReferencedFactionNames);
            referencedLocations.AddRange(plan.ReferencedLocationNames);
        }

        foreach (var blueprint in blueprints ?? Array.Empty<ChapterBlueprint>())
        {
            referencedCharacters.AddRange(SplitNames(blueprint.Cast));
            referencedFactions.AddRange(SplitNames(blueprint.Factions));
            referencedLocations.AddRange(SplitNames(blueprint.Locations));
        }

        yield return BuildUnknownReferenceItem("引用角色", referencedCharacters, context.CharacterNames);
        yield return BuildUnknownReferenceItem("引用势力", referencedFactions, context.FactionNames);
        yield return BuildUnknownReferenceItem("引用地点", referencedLocations, context.LocationNames);
    }

    private static IEnumerable<ValidationItem> BuildTrackingItems(Chapter chapter, ValidationRuleContext context)
    {
        context.PlotPointsByChapterId.TryGetValue(chapter.Id, out var plotPoints);
        context.TimelinesByChapterId.TryGetValue(chapter.Id, out var timelines);
        context.MovementsByChapterId.TryGetValue(chapter.Id, out var movements);

        yield return BuildItem(
            "tracking",
            "剧情节点回写",
            plotPoints is { Count: > 0 } ? "passed" : "warning",
            plotPoints is { Count: > 0 } ? $"已记录 {plotPoints.Count} 个剧情节点。" : "未发现当前章节剧情节点回写。",
            "生成通过门禁后应写回 PlotPoint,用于后续校验和索引。");

        yield return BuildItem(
            "tracking",
            "时间线回写",
            timelines is { Count: > 0 } ? "passed" : "warning",
            timelines is { Count: > 0 } ? $"已记录 {timelines.Count} 条时间线。" : "未发现当前章节时间推进记录。",
            "若章节存在明显时间推进,应写回 ChapterTimeline。");

        yield return BuildItem(
            "tracking",
            "角色移动回写",
            movements is { Count: > 0 } ? "passed" : "warning",
            movements is { Count: > 0 } ? $"已记录 {movements.Count} 条角色移动。" : "未发现当前章节角色移动记录。",
            "若章节发生场景迁移,应写回 CharacterMovement/CharacterLocation。");

        var chapterMarker = chapter.ChapterNumber.ToString();
        var foreshadowings = context.ForeshadowingsByChapterMarker
            .Where(kv => string.Equals(kv.Key, chapter.Id, StringComparison.OrdinalIgnoreCase) || kv.Key == chapterMarker)
            .SelectMany(kv => kv.Value)
            .DistinctBy(f => f.Id)
            .ToList();

        yield return BuildItem(
            "tracking",
            "伏笔逾期",
            foreshadowings.Any(f => f.IsOverdue) ? "warning" : "passed",
            foreshadowings.Any(f => f.IsOverdue)
                ? $"存在逾期伏笔：{string.Join("、", foreshadowings.Where(f => f.IsOverdue).Select(f => f.Name).Take(5))}"
                : "当前章节未命中逾期伏笔。",
            "处理逾期伏笔或调整预期回收章节。");
    }

    private static ValidationItem BuildUnknownReferenceItem(string name, IEnumerable<string> references, IReadOnlySet<string> knownNames)
    {
        var normalized = references
            .SelectMany(SplitNames)
            .Where(x => !LooksLikePlaceholder(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var missing = normalized.Where(x => !knownNames.Contains(x)).ToList();

        return BuildItem(
            "reference",
            name,
            missing.Count == 0 ? "passed" : "failed",
            normalized.Count == 0
                ? $"{name}为空。"
                : missing.Count == 0
                    ? $"{name}均可解析。"
                    : $"未知{name}：{string.Join("、", missing.Take(12))}",
            "补齐对应设计规则,或修正规划/蓝图里的引用名称。");
    }

    private static ValidationItem BuildItem(
        string type,
        string name,
        string result,
        string details,
        string suggestion)
        => new()
        {
            ValidationType = type,
            Name = name,
            Result = result,
            Details = details,
            Suggestion = result == "passed" ? string.Empty : suggestion
        };

    private async Task<ValidationRuleContext> BuildRuleContextAsync(
        string projectId,
        IReadOnlyList<Chapter> chapters,
        CancellationToken ct)
    {
        var chapterIds = chapters.Select(c => c.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var chapterNumbers = chapters.Select(c => c.ChapterNumber).ToHashSet();
        var project = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == projectId, ct);
        var sourceBookId = project?.CurrentSourceBookId;

        var plans = await FilterBusinessBySourceBook(
                _db.ChapterPlans.AsNoTracking().Where(p => chapterNumbers.Contains(p.ChapterNumber)),
                sourceBookId)
            .ToListAsync(ct);
        var blueprints = await FilterBusinessBySourceBook(
                _db.ChapterBlueprints.AsNoTracking().Where(b => chapterIds.Contains(b.ChapterId)),
                sourceBookId)
            .ToListAsync(ct);

        var characters = await FilterBusinessBySourceBook(_db.CharacterRules.AsNoTracking().Where(x => x.IsEnabled), sourceBookId)
            .Select(x => x.Name)
            .ToListAsync(ct);
        var factions = await FilterBusinessBySourceBook(_db.FactionRules.AsNoTracking().Where(x => x.IsEnabled), sourceBookId)
            .Select(x => x.Name)
            .ToListAsync(ct);
        var locations = await FilterBusinessBySourceBook(_db.LocationRules.AsNoTracking().Where(x => x.IsEnabled), sourceBookId)
            .Select(x => x.Name)
            .ToListAsync(ct);

        var foreshadowings = await FilterTrackingBySourceBook(
                _db.Foreshadowings.AsNoTracking().Where(f => f.ProjectId == projectId),
                sourceBookId)
            .ToListAsync(ct);
        var timelines = await FilterTrackingBySourceBook(
                _db.ChapterTimelines.AsNoTracking().Where(t => t.ProjectId == projectId && chapterIds.Contains(t.ChapterId)),
                sourceBookId)
            .ToListAsync(ct);
        var movements = await FilterTrackingBySourceBook(
                _db.CharacterMovements.AsNoTracking().Where(m => m.ProjectId == projectId && chapterIds.Contains(m.ChapterId)),
                sourceBookId)
            .ToListAsync(ct);
        var plotPoints = await FilterTrackingBySourceBook(
                _db.PlotPoints.AsNoTracking().Where(p => p.ProjectId == projectId && chapterIds.Contains(p.ChapterId)),
                sourceBookId)
            .ToListAsync(ct);

        return new ValidationRuleContext(
            plans.GroupBy(p => p.ChapterNumber).ToDictionary(g => g.Key, g => (IReadOnlyList<ChapterPlan>)g.ToList()),
            blueprints.GroupBy(b => b.ChapterId).ToDictionary(g => g.Key, g => (IReadOnlyList<ChapterBlueprint>)g.ToList(), StringComparer.OrdinalIgnoreCase),
            BuildNameSet(characters),
            BuildNameSet(factions),
            BuildNameSet(locations),
            BuildForeshadowingMap(foreshadowings),
            timelines.GroupBy(t => t.ChapterId).ToDictionary(g => g.Key, g => (IReadOnlyList<ChapterTimeline>)g.ToList(), StringComparer.OrdinalIgnoreCase),
            movements.GroupBy(m => m.ChapterId).ToDictionary(g => g.Key, g => (IReadOnlyList<CharacterMovement>)g.ToList(), StringComparer.OrdinalIgnoreCase),
            plotPoints.GroupBy(p => p.ChapterId).ToDictionary(g => g.Key, g => (IReadOnlyList<PlotPoint>)g.ToList(), StringComparer.OrdinalIgnoreCase));
    }

    private static IReadOnlySet<string> BuildNameSet(IEnumerable<string> names)
        => names
            .SelectMany(SplitNames)
            .Where(x => !LooksLikePlaceholder(x))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

    private static IReadOnlyDictionary<string, IReadOnlyList<Foreshadowing>> BuildForeshadowingMap(IEnumerable<Foreshadowing> rows)
    {
        var map = new Dictionary<string, List<Foreshadowing>>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in rows)
        {
            foreach (var key in SplitNames(JoinNonEmpty(row.ExpectedSetupChapter, row.ExpectedPayoffChapter, row.ActualSetupChapter, row.ActualPayoffChapter)))
            {
                if (!map.TryGetValue(key, out var list))
                {
                    list = new List<Foreshadowing>();
                    map[key] = list;
                }
                list.Add(row);
            }
        }

        return map.ToDictionary(kv => kv.Key, kv => (IReadOnlyList<Foreshadowing>)kv.Value, StringComparer.OrdinalIgnoreCase);
    }

    private static string ResolveChapterStatusResult(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return "warning";
        return AllowedChapterStatuses.Contains(status.Trim()) ? "passed" : "failed";
    }

    private static string ResolveChapterStatusDetails(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return "章节状态为空。";
        var normalized = status.Trim();
        return AllowedChapterStatuses.Contains(normalized)
            ? $"当前状态：{normalized}"
            : $"章节状态非法：{normalized}";
    }

    private static object BuildModuleResults(IReadOnlyList<Chapter> chapters, IReadOnlyList<ValidationReport> reports, DateTime checkedAt)
    {
        var failed = reports.Count(r => r.Result == "failed");
        var warning = reports.Count(r => r.Result == "warning");
        var passed = reports.Count(r => r.Result == "passed");

        return new
        {
            staticConsistency = new
            {
                result = ResolveOverallResult(reports.Select(r => r.Result)),
                totalChapters = chapters.Count,
                passedReports = passed,
                warningReports = warning,
                failedReports = failed,
                checkedAt
            }
        };
    }

    private static string ResolveOverallResult(IEnumerable<string> results)
    {
        var list = results.ToList();
        if (list.Any(r => r == "failed")) return "failed";
        if (list.Any(r => r == "warning")) return "warning";
        return "passed";
    }

    private static ValidationSummaryDto ToDto(ValidationSummary s)
        => new(
            s.Id,
            s.ProjectId,
            s.TargetVolumeNumber,
            s.LastRunId,
            s.OverallResult,
            s.ModuleResults,
            s.ProblemItems,
            s.LastValidatedAt,
            s.CreatedAt,
            s.UpdatedAt);

    private static ValidationReportDto ToDto(ValidationReport r, Chapter? chapter)
        => new(
            r.Id,
            r.ProjectId,
            r.ChapterId,
            r.RunId,
            chapter?.ChapterNumber ?? 0,
            chapter?.Title ?? string.Empty,
            chapter?.Status ?? string.Empty,
            r.ValidatedAt,
            r.Result,
            r.Summary,
            r.Items.OrderBy(i => i.ValidationType).ThenBy(i => i.Name).Select(ToDto).ToList(),
            r.CreatedAt,
            r.UpdatedAt);

    private static ValidationItemDto ToDto(ValidationItem i)
        => new(i.Id, i.ValidationType, i.Name, i.Result, i.Details, i.Suggestion);

    private static string NormalizeChapterStatus(string? status)
    {
        var normalized = string.IsNullOrWhiteSpace(status) ? string.Empty : status.Trim();
        if (!AllowedChapterStatuses.Contains(normalized))
        {
            throw new InvalidOperationException(
                "章节状态必须是 planned / blueprinted / drafted / needs_fix / validated / archived 之一。");
        }

        return normalized;
    }
}
