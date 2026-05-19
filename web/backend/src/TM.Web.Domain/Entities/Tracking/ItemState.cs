using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Tracking;

public class ItemStateEntry : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;
    public string? SourceBookId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string CurrentHolder { get; set; } = string.Empty;
    public string CurrentStatus { get; set; } = "active";

    public ICollection<ItemStatePoint> StateHistory { get; set; } = new List<ItemStatePoint>();
}

public class ItemStatePoint : EntityBase
{
    public string ItemStateEntryId { get; set; } = string.Empty;
    public string ChapterId { get; set; } = string.Empty;

    public string Holder { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
    public string Event { get; set; } = string.Empty;
    public string Importance { get; set; } = "normal";

    public ItemStateEntry? ItemStateEntry { get; set; }
}
