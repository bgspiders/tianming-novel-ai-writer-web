namespace TM.Services.Modules.ProjectData.Implementations;

/// <summary>
/// Web 兼容版分层上下文参数。
/// 原类型定义在 GuideContextService.cs 内；Web 端暂未接入完整 GuideContextService，
/// 但 ProjectData 的里程碑、归档和裁剪服务仍需要这些默认参数。
/// </summary>
public static class LayeredContextConfig
{
    public static int PreviousSummaryCount { get; set; } = 30;
    public const int MdFallbackMaxDistance = 1;
    public static int MdSummaryExtractLength { get; set; } = 500;
    public static int ActiveEntityWindowChapters { get; set; } = 8;
    public static int ActiveEntityWindowMaxCount { get; set; } = 25;
    public static int SummaryRecentWindowCount { get; set; } = 30;
    public static int MilestoneAnchorInterval { get; set; } = 8;
    public static int VolumeMilestoneMaxChars { get; set; } = 20000;
    public static int VolumeMilestoneTailRecentCount { get; set; } = 15;
    public const int PreviousChapterTailLength = 1000;
    public const int PreviousChapterTailMinLength = 200;
    public static int LedgerCharacterStateKeepRecent { get; set; } = 10000000;
    public static int LedgerConflictProgressKeepRecent { get; set; } = 2000000;
    public static int LedgerPlotPointsKeepRecent { get; set; } = 10000000;
    public static int LedgerLocationStateKeepRecent { get; set; } = 5000000;
    public static int LedgerFactionStateKeepRecent { get; set; } = 5000000;
    public static int LedgerTimelineKeepRecent { get; set; } = 10000000;
    public static int LedgerMovementKeepRecent { get; set; } = 5000000;
    public static int LedgerItemStateKeepRecent { get; set; } = 5000000;
    public static int LedgerMaxCriticalPerEntity { get; set; } = int.MaxValue;
    public static int LedgerImportantKeepRecent { get; set; } = 2000000;
    public static int LedgerNormalSampleInterval { get; set; } = 50;
    public static int DriftWarningsMaxPerEntity { get; set; } = 100000;
    public static int SnapshotMaxFactionInject { get; set; } = 30;
    public static int SnapshotMaxItemInject { get; set; } = 50;
    public static int SnapshotMaxTimelineInject { get; set; } = 5;
    public static int MilestoneMaxPreviousVolumes { get; set; } = 12;
    public static int ArchiveMaxPreviousVolumes { get; set; } = 8;
    public static int ArchiveInjectMaxCharacterStates { get; set; } = 60;
    public static int ArchiveInjectMaxConflictProgress { get; set; } = 25;
    public static int ArchiveInjectMaxTimelineEntries { get; set; } = 10;
    public static int ArchiveInjectMaxCharacterLocations { get; set; } = 50;
    public static int ArchiveInjectMaxFactionStates { get; set; } = 20;
    public static int ArchiveInjectMaxLocationStates { get; set; } = 20;
    public static int ArchiveInjectMaxFieldChars { get; set; } = 300;
    public static int ArchiveInjectMaxItemStates { get; set; } = 50;
    public static int ArchiveInjectMaxForeshadowingStatus { get; set; } = 40;

    public static Task InitializeFromStorageAsync() => Task.CompletedTask;

    public static Task SaveToStorageAsync() => Task.CompletedTask;
}
