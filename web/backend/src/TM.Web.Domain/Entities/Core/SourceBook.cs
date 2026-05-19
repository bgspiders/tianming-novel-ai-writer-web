using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Core;

/// <summary>
/// 拆书来源记录的"源书"，作为创意素材和五大规则的范围隔离键。
/// 注意：原项目 book_analyses 既是拆书结果数据，又承担 source_book 元信息，本表把元信息抽出。
/// </summary>
public class SourceBook : EntityBase
{
    public string Name { get; set; } = string.Empty;

    public string Author { get; set; } = string.Empty;

    public string Genre { get; set; } = string.Empty;

    public string? Site { get; set; }

    public string? Url { get; set; }

    public int ChapterCount { get; set; }

    public int TotalWordCount { get; set; }

    public DateTime? CrawledAt { get; set; }
}
