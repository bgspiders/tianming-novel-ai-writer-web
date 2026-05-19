using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Tracking;

public class LocationStateEntry : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;
    public string LocationId { get; set; } = string.Empty;
    public string? SourceBookId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string CurrentStatus { get; set; } = "normal";

    public ICollection<LocationStatePoint> StateHistory { get; set; } = new List<LocationStatePoint>();
}

public class LocationStatePoint : EntityBase
{
    public string LocationStateEntryId { get; set; } = string.Empty;
    public string ChapterId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;
    public string Event { get; set; } = string.Empty;
    public string Importance { get; set; } = "normal";

    public LocationStateEntry? LocationStateEntry { get; set; }
}
