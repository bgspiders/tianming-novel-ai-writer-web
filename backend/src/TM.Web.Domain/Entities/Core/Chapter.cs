using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Core;

/// <summary>
/// 章节元数据。正文（Markdown）仍以文件保留在 Storage/projects/{projectId}/chapters/{chapterId}.md。
/// </summary>
public class Chapter : EntityBase
{
    public string VolumeId { get; set; } = string.Empty;

    public string ProjectId { get; set; } = string.Empty;

    public int ChapterNumber { get; set; }

    public string Title { get; set; } = string.Empty;

    public int WordCount { get; set; }

    /// <summary>本章简要摘要（用于召回链 + 上下文）。</summary>
    public string Summary { get; set; } = string.Empty;

    /// <summary>相对 Storage 根目录的 .md 文件路径。</summary>
    public string ContentFilePath { get; set; } = string.Empty;

    /// <summary>章节状态：planned / blueprinted / drafted / validated / archived。</summary>
    public string Status { get; set; } = "planned";

    public Volume? Volume { get; set; }

    public Project? Project { get; set; }
}
