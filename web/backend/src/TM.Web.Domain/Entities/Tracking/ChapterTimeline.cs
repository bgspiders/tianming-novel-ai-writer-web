using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Tracking;

/// <summary>
/// 每章时间推进。一章一行。
/// </summary>
public class ChapterTimeline : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;
    public string ChapterId { get; set; } = string.Empty;
    public string? SourceBookId { get; set; }

    public string TimePeriod { get; set; } = string.Empty;
    public string ElapsedTime { get; set; } = string.Empty;
    public string KeyTimeEvent { get; set; } = string.Empty;
    public string Importance { get; set; } = "normal";
}
