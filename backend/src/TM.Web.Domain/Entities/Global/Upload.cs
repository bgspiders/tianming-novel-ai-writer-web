using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Global;

/// <summary>
/// 上传文件元数据。文件本体在 Storage/uploads/{yyyy}/{mm}/{uuid}.{ext}（数据模型映射.md 节 3.3）。
/// </summary>
public class Upload : EntityBase
{
    public string FileName { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;

    /// <summary>相对 Storage 根目录的文件路径。</summary>
    public string StoragePath { get; set; } = string.Empty;

    public long SizeBytes { get; set; }

    public string Sha256 { get; set; } = string.Empty;

    /// <summary>来源用途：avatar / cover / theme-image / chapter-attachment。</summary>
    public string? Purpose { get; set; }
}
