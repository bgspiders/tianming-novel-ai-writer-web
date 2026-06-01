using System.Text.Json;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace TM.Web.Infrastructure.Persistence;

/// <summary>
/// 复用的 EF Core ValueConverter 集合。SQLite 没有原生 JSON 列类型，
/// 用 TEXT 列 + 序列化/反序列化模拟。
///
/// 注意：ValueConverter 的 Lambda 会被 EF 翻译为表达式树，不能用 ??（空传播）、模式匹配等高级语法，
/// 因此空安全用三元 + 静态辅助方法处理。
/// </summary>
public static class JsonValueConverters
{
    private static readonly JsonSerializerOptions Options = new()
    {
        WriteIndented = false,
        PropertyNamingPolicy = null,
    };

    public static ValueConverter<List<string>, string> StringList { get; } = new(
        list => SerializeList(list),
        json => DeserializeList(json));

    public static ValueConverter<Dictionary<string, int>, string> StringIntDictionary { get; } = new(
        dict => SerializeDict(dict),
        json => DeserializeDict(json));

    public static ValueComparer<List<string>> StringListComparer { get; } = new(
        (a, b) => StringListEqual(a, b),
        x => x == null ? 0 : x.Aggregate(17, (h, v) => h * 31 + (v == null ? 0 : v.GetHashCode())),
        x => x == null ? new List<string>() : new List<string>(x));

    public static ValueComparer<Dictionary<string, int>> StringIntDictionaryComparer { get; } = new(
        (a, b) => DictionaryEqual(a, b),
        x => x == null ? 0 : x.Aggregate(17, (h, kv) => h * 31 + (kv.Key.GetHashCode() ^ kv.Value)),
        x => x == null ? new Dictionary<string, int>() : new Dictionary<string, int>(x));

    private static string SerializeList(List<string>? list)
        => JsonSerializer.Serialize(list ?? new List<string>(), Options);

    private static List<string> DeserializeList(string? json)
    {
        if (string.IsNullOrEmpty(json)) return new List<string>();
        return JsonSerializer.Deserialize<List<string>>(json, Options) ?? new List<string>();
    }

    private static string SerializeDict(Dictionary<string, int>? dict)
        => JsonSerializer.Serialize(dict ?? new Dictionary<string, int>(), Options);

    private static Dictionary<string, int> DeserializeDict(string? json)
    {
        if (string.IsNullOrEmpty(json)) return new Dictionary<string, int>();
        return JsonSerializer.Deserialize<Dictionary<string, int>>(json, Options) ?? new Dictionary<string, int>();
    }

    private static bool StringListEqual(List<string>? a, List<string>? b)
    {
        var left = a ?? new List<string>();
        var right = b ?? new List<string>();
        return left.SequenceEqual(right);
    }

    private static bool DictionaryEqual(Dictionary<string, int>? a, Dictionary<string, int>? b)
    {
        var left = a ?? new Dictionary<string, int>();
        var right = b ?? new Dictionary<string, int>();
        if (left.Count != right.Count) return false;
        foreach (var kv in left)
        {
            if (!right.TryGetValue(kv.Key, out var v) || v != kv.Value) return false;
        }
        return true;
    }
}
