using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Metadata;

/// <summary>
/// 项目当前工作范围（一项目一行）。原 Storage/Projects/.../Config/work_scope.json。
/// 决定打包/校验/生成时实际激活的 SourceBookId 范围。
/// </summary>
public class WorkScope : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;
    public string? CurrentSourceBookId { get; set; }
}
