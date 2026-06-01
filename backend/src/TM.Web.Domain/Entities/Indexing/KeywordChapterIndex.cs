using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Indexing;

/// <summary>
/// 关键词到章节的倒排索引。同一对 (Keyword, ChapterId) 唯一。
/// </summary>
public class KeywordChapterIndex : EntityBase
{
    public string ProjectId { get; set; } = string.Empty;
    public string? SourceBookId { get; set; }

    public string Keyword { get; set; } = string.Empty;
    public string ChapterId { get; set; } = string.Empty;

    /// <summary>在该章中的出现次数。</summary>
    public int OccurrenceCount { get; set; } = 1;
}
