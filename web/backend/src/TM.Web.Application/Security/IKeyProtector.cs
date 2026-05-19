namespace TM.Web.Application.Security;

/// <summary>
/// 对称密钥保护抽象。用 AES-GCM 加密 API Key 后存入 ai_api_keys.EncryptedKey + Iv。
/// </summary>
public interface IKeyProtector
{
    /// <summary>加密明文，返回（密文+tag, 12 字节 nonce）。</summary>
    (byte[] cipher, byte[] iv) Encrypt(string plaintext);

    /// <summary>解密。如果 master key 不匹配（如 master.key 文件被替换）会抛 CryptographicException。</summary>
    string Decrypt(byte[] cipher, byte[] iv);

    /// <summary>给前端展示用的明文尾段，如 "...abcd"。</summary>
    string ComputeMaskedTail(string plaintext);
}
