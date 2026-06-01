using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Tracking;

public class FactionStateEntry : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;
    public string FactionId { get; set; } = string.Empty;
    public string? SourceBookId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string CurrentStatus { get; set; } = "active";

    public ICollection<FactionStatePoint> StateHistory { get; set; } = new List<FactionStatePoint>();
}

public class FactionStatePoint : EntityBase
{
    public string FactionStateEntryId { get; set; } = string.Empty;
    public string ChapterId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;
    public string Event { get; set; } = string.Empty;
    public string Importance { get; set; } = "normal";

    public FactionStateEntry? FactionStateEntry { get; set; }
}
