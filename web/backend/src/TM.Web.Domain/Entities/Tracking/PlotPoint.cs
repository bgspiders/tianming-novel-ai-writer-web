using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Tracking;

/// <summary>
/// 剧情节点（按章归档的关键事件）。Keywords/InvolvedCharacters 用 JSON 列；
/// 倒排索引（keyword → chapters）由 keyword_chapter_index 表承担。
/// </summary>
public class PlotPoint : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;
    public string ChapterId { get; set; } = string.Empty;
    public string? SourceBookId { get; set; }

    public string Context { get; set; } = string.Empty;
    public List<string> Keywords { get; set; } = new();
    public List<string> InvolvedCharacters { get; set; } = new();
    public string Importance { get; set; } = "normal";
    public string Storyline { get; set; } = "main";
}
