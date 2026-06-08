using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Runtime;

public class ChapterBatchGenerationJobLog : EntityBase
{
    public string JobId { get; set; } = string.Empty;

    public string ProjectId { get; set; } = string.Empty;

    public string Level { get; set; } = "info";

    public string Message { get; set; } = string.Empty;
}
