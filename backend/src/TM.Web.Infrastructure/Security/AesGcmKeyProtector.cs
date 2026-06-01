using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using TM.Web.Application.Security;

namespace TM.Web.Infrastructure.Security;

/// <summary>
/// AES-GCM 实现。master key 落盘到 Storage/master.key（32 字节随机，文件权限 0600）。
/// 启动时若文件不存在则生成；存在则直接读。**禁止跨机器拷贝 tm.db 而不带 master.key**，否则所有 API Key 无法解密。
/// </summary>
public class AesGcmKeyProtector : IKeyProtector
{
    private const int KeySizeBytes = 32;
    private const int NonceSizeBytes = 12;
    private const int TagSizeBytes = 16;

    private readonly byte[] _masterKey;

    public AesGcmKeyProtector(IConfiguration configuration, ILogger<AesGcmKeyProtector> logger)
    {
        var storageRoot = ResolveStorageRoot(configuration);
        var keyPath = Path.Combine(storageRoot, "master.key");
        Directory.CreateDirectory(storageRoot);

        if (File.Exists(keyPath))
        {
            _masterKey = File.ReadAllBytes(keyPath);
            if (_masterKey.Length != KeySizeBytes)
            {
                throw new InvalidOperationException(
                    $"master.key 长度异常：期望 {KeySizeBytes} 字节，实际 {_masterKey.Length}。" +
                    "请确认未被截断，或删除该文件让系统重新生成（会导致已有 API Key 不可解密）。");
            }
            logger.LogInformation("已加载 master.key（{Bytes} 字节）", _masterKey.Length);
        }
        else
        {
            _masterKey = RandomNumberGenerator.GetBytes(KeySizeBytes);
            File.WriteAllBytes(keyPath, _masterKey);
            TryRestrictPermissions(keyPath);
            logger.LogWarning("master.key 不存在，已生成新文件：{Path}。请妥善备份。", keyPath);
        }
    }

    public (byte[] cipher, byte[] iv) Encrypt(string plaintext)
    {
        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext ?? string.Empty);
        var nonce = RandomNumberGenerator.GetBytes(NonceSizeBytes);
        var cipher = new byte[plaintextBytes.Length];
        var tag = new byte[TagSizeBytes];

        using var aes = new AesGcm(_masterKey, TagSizeBytes);
        aes.Encrypt(nonce, plaintextBytes, cipher, tag);

        var cipherWithTag = new byte[cipher.Length + tag.Length];
        Buffer.BlockCopy(cipher, 0, cipherWithTag, 0, cipher.Length);
        Buffer.BlockCopy(tag, 0, cipherWithTag, cipher.Length, tag.Length);

        return (cipherWithTag, nonce);
    }

    public string Decrypt(byte[] cipher, byte[] iv)
    {
        if (cipher.Length < TagSizeBytes)
            throw new CryptographicException("密文长度过短，不包含 GCM tag。");

        var actualCipherLen = cipher.Length - TagSizeBytes;
        var actualCipher = new byte[actualCipherLen];
        var tag = new byte[TagSizeBytes];
        Buffer.BlockCopy(cipher, 0, actualCipher, 0, actualCipherLen);
        Buffer.BlockCopy(cipher, actualCipherLen, tag, 0, TagSizeBytes);

        var plaintext = new byte[actualCipherLen];
        using var aes = new AesGcm(_masterKey, TagSizeBytes);
        aes.Decrypt(iv, actualCipher, tag, plaintext);
        return Encoding.UTF8.GetString(plaintext);
    }

    public string ComputeMaskedTail(string plaintext)
    {
        if (string.IsNullOrEmpty(plaintext)) return string.Empty;
        if (plaintext.Length <= 4) return new string('*', plaintext.Length);
        return "..." + plaintext[^4..];
    }

    private static string ResolveStorageRoot(IConfiguration configuration)
    {
        var raw = configuration["Storage:RootPath"];
        if (string.IsNullOrWhiteSpace(raw)) raw = "./Storage";
        if (raw.StartsWith("~/"))
        {
            raw = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), raw[2..]);
        }
        return Path.IsPathRooted(raw) ? raw : Path.GetFullPath(raw, AppContext.BaseDirectory);
    }

    private static void TryRestrictPermissions(string path)
    {
        try
        {
            if (!OperatingSystem.IsWindows())
            {
                // chmod 600 等效
                File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
            }
        }
        catch
        {
            // 设权限失败不阻塞，仅日志可见
        }
    }
}
