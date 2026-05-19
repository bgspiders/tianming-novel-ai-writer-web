using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.AI;

/// <summary>
/// API Key 加密存储。Key 永不以明文形式落库；EncryptedKey + Iv 由 AES-GCM 加密，master key 文件独立存放。
/// 阶段 2 接入 AI 模型管理时实现具体加密流程。
/// </summary>
public class AiApiKey : EntityBase
{
    public string ProviderId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    /// <summary>AES-GCM 密文（含 tag）。</summary>
    public byte[] EncryptedKey { get; set; } = Array.Empty<byte>();

    /// <summary>AES-GCM 12 字节随机 nonce。</summary>
    public byte[] Iv { get; set; } = Array.Empty<byte>();

    /// <summary>仅用于显示的尾部明文（如 "...abcd"），不参与加密。</summary>
    public string? MaskedTail { get; set; }

    public bool IsEnabled { get; set; } = true;

    /// <summary>多 Key 轮换次序。</summary>
    public int RotationOrder { get; set; }

    public DateTime? LastUsedAt { get; set; }

    public AiProvider? Provider { get; set; }
}
