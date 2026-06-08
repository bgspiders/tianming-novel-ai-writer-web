using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Runtime;

public class ChapterAnalysisReport : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;

    public string ChapterId { get; set; } = string.Empty;

    public bool Passed { get; set; }

    public bool ShouldPauseBatch { get; set; }

    public int WordCount { get; set; }

    public int CoherenceScore { get; set; }

    public int QualityScore { get; set; }

    public string Summary { get; set; } = string.Empty;

    public string ItemsJson { get; set; } = "[]";
}
