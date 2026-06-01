using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Tracking;

public class ConflictProgressEntry : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;
    public string? SourceBookId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Tier { get; set; } = "Tier-3";
    public string Status { get; set; } = "pending";
    public List<string> InvolvedChapters { get; set; } = new();
    public List<string> InvolvedCharacters { get; set; } = new();

    public ICollection<ConflictProgressPoint> ProgressPoints { get; set; } = new List<ConflictProgressPoint>();
}

public class ConflictProgressPoint : EntityBase
{
    public string ConflictProgressEntryId { get; set; } = string.Empty;
    public string ChapterId { get; set; } = string.Empty;

    public string Event { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Importance { get; set; } = "normal";

    public ConflictProgressEntry? ConflictProgressEntry { get; set; }
}
