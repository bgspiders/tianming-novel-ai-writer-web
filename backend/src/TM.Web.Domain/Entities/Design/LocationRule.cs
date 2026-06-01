using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Design;

/// <summary>
/// 地点规则。Landmarks/Resources/Dangers 三个 List 用 JSON 列存储（数据模型映射.md 节 2.2）。
/// </summary>
public class LocationRule : BusinessDataBase
{
    // Tab1: 基本信息
    public string LocationType { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Scale { get; set; } = string.Empty;

    // Tab2: 地理特征
    public string Terrain { get; set; } = string.Empty;
    public string Climate { get; set; } = string.Empty;
    public List<string> Landmarks { get; set; } = new();
    public List<string> Resources { get; set; } = new();

    // Tab3: 故事关联
    public string HistoricalSignificance { get; set; } = string.Empty;
    public List<string> Dangers { get; set; } = new();

    /// <summary>所属势力外键（可选）。</summary>
    public string? FactionId { get; set; }
}
