using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Core;

/// <summary>
/// 顶层项目（一本书）。原 Storage/Projects/{name}/manifest.json 的入口。
/// </summary>
public class Project : EntityBase
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    /// <summary>当前激活的 SourceBookId（对应原 work_scope.json）。</summary>
    public string? CurrentSourceBookId { get; set; }

    /// <summary>打包发布的最新版本号。</summary>
    public int Version { get; set; } = 0;

    public DateTime LastModifiedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Volume> Volumes { get; set; } = new List<Volume>();

    public ICollection<Chapter> Chapters { get; set; } = new List<Chapter>();
}
