using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Runtime;

public class NovelSeedWorkflow : EntityBase
{
    public string Status { get; set; } = "draft";

    public string RequestJson { get; set; } = "{}";

    public string? ProjectId { get; set; }

    public string Error { get; set; } = string.Empty;
}
