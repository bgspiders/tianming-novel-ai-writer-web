using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Metadata;

/// <summary>
/// 项目打包/发布快照清单。原 Storage/Projects/{name}/manifest.json + History/v{version}/。
/// Files/EnabledModules/Statistics 用 JSON 列。
/// </summary>
public class Manifest : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;
    public int Version { get; set; }

    public string? SourceBookId { get; set; }
    public DateTime PublishedAt { get; set; } = DateTime.UtcNow;

    /// <summary>打包包含的文件清单（path → sha256）JSON。</summary>
    public string Files { get; set; } = "[]";

    /// <summary>启用的模块清单 JSON。</summary>
    public string EnabledModules { get; set; } = "[]";

    /// <summary>统计信息 JSON（字数、章数、生成耗时等）。</summary>
    public string Statistics { get; set; } = "{}";
}
