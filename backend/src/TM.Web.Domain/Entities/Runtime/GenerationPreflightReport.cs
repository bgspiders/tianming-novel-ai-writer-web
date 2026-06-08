using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Runtime;

public class GenerationPreflightReport : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;

    public string? VolumeId { get; set; }

    public string? ChapterId { get; set; }

    public bool Passed { get; set; }

    public int FatalCount { get; set; }

    public int WarningCount { get; set; }

    public string ItemsJson { get; set; } = "[]";
}
