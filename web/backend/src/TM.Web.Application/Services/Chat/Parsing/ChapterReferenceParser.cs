using System.Text.RegularExpressions;

namespace TM.Web.Application.Services.Chat.Parsing;

internal static partial class ChapterReferenceParser
{
    private const string ChineseNumChars = "一二三四五六七八九十百千万零壹贰叁肆伍陆柒捌玖拾佰仟萬两兩〇";
    private const string ChineseNumPattern = "[" + ChineseNumChars + "]";
    private const string MixedNumPattern = "(?:" + ChineseNumPattern + "+|\\d+)";

    private static readonly Regex ChapterTitleRegex = BuildChapterTitleRegex();
    private static readonly Regex ChapterTitleDetectRegex = BuildChapterTitleDetectRegex();
    private static readonly Regex EnglishChapterRegex = BuildEnglishChapterRegex();
    private static readonly Regex SpecialChapterRegex = BuildSpecialChapterRegex();
    private static readonly Regex RangeRegex = BuildRangeRegex();
    private static readonly Regex ChapterTokenRegex = BuildChapterTokenRegex();

    private static readonly string[] BatchKeywords =
    [
        "批量", "多章", "几章", "所有章", "全部章", "所有章节", "全部章节", "连续", "章到", "~", "-到", "-至", "到第", "至第"
    ];

    private static readonly string[] SingleKeywords =
    [
        "生成第", "写第", "创作第", "续写第", "完善第", "扩写第", "修改第",
        "重写第", "改写第", "润色第", "开始写第", "开始生成第",
        "帮我写第", "帮我生成第", "来写第", "来生成第"
    ];

    public static bool IsSingleChapterTask(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return false;
        }

        var normalized = text.Replace(" ", string.Empty).ToLowerInvariant();
        if (ParseChapterRange(text) is not null || ParseChapterNumberList(text)?.Count >= 2)
        {
            return false;
        }

        if (BatchKeywords.Any(normalized.Contains))
        {
            return false;
        }

        if (Regex.IsMatch(text, $@"(?:生成|写|创作|续写|重写|改写|补全|扩写|润色|仿写|完善|修改)\s*第?\s*{MixedNumPattern}\s*张"))
        {
            return true;
        }

        if (Regex.IsMatch(text, $@"(?:生成|写|创作|续写|重写|改写|补全|扩写|润色|仿写|完善|修改)\s*{MixedNumPattern}\s*(?:章节|章)"))
        {
            return true;
        }

        return SingleKeywords.Any(kw => normalized.Contains(kw))
            && (normalized.Contains("章") || normalized.Contains("章节"));
    }

    public static (int Start, int End)? ParseChapterRange(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        var normalized = NormalizeRangeSeparators(text);
        var match = RangeRegex.Match(normalized);
        if (!match.Success)
        {
            return null;
        }

        var start = ChineseNumberParser.Parse(match.Groups["start"].Value);
        var end = ChineseNumberParser.Parse(match.Groups["end"].Value);
        if (start <= 0 || end <= 0)
        {
            return null;
        }

        if (end < start)
        {
            (start, end) = (end, start);
        }

        return (start, end);
    }

    public static IReadOnlyList<int>? ParseChapterNumberList(string? text)
    {
        if (string.IsNullOrWhiteSpace(text) || ParseChapterRange(text) is not null)
        {
            return null;
        }

        var numbers = new HashSet<int>();
        foreach (Match match in ChapterTokenRegex.Matches(text))
        {
            var number = ChineseNumberParser.Parse(match.Groups["num"].Value);
            if (number > 0)
            {
                numbers.Add(number);
            }
        }

        return numbers.Count >= 2 ? numbers.Order().ToList() : null;
    }

    public static bool IsChapterTitle(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return false;
        }

        var trimmed = text.Trim();
        return ChapterTitleDetectRegex.IsMatch(trimmed)
            || SpecialChapterRegex.IsMatch(trimmed)
            || EnglishChapterRegex.IsMatch(trimmed);
    }

    public static (int? Number, string? Name) ExtractChapterParts(string? title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return (null, null);
        }

        var trimmed = title.Trim();
        var match = ChapterTitleRegex.Match(trimmed);
        if (match.Success)
        {
            var number = ChineseNumberParser.Parse(match.Groups["num"].Value);
            var name = match.Groups["name"].Value.Trim();
            return (number > 0 ? number : null, string.IsNullOrWhiteSpace(name) ? null : name);
        }

        var special = SpecialChapterRegex.Match(trimmed);
        if (special.Success)
        {
            var type = special.Groups[1].Value;
            var name = special.Groups[2].Value.Trim().TrimStart('：', ':', '.').Trim();
            return (null, string.IsNullOrWhiteSpace(name) ? type : $"{type} {name}");
        }

        var english = EnglishChapterRegex.Match(trimmed);
        if (!english.Success)
        {
            return (null, null);
        }

        var chapter = int.Parse(english.Groups[1].Value);
        var remaining = trimmed[english.Length..].Trim().TrimStart(':', '-', '.').Trim();
        return (chapter, string.IsNullOrWhiteSpace(remaining) ? null : remaining);
    }

    private static string NormalizeRangeSeparators(string text)
        => text
            .Replace('－', '-')
            .Replace('–', '-')
            .Replace('—', '-')
            .Replace('−', '-')
            .Replace('‐', '-')
            .Replace('‑', '-')
            .Replace('‒', '-')
            .Replace('―', '-')
            .Replace('﹣', '-')
            .Replace('﹘', '-')
            .Replace('～', '-')
            .Replace('〜', '-');

    [GeneratedRegex("^第(?<num>[一二三四五六七八九十百千万零壹贰叁肆伍陆柒捌玖拾佰仟萬两兩〇]+|\\d+)(?:章节|章)([：:.]?)\\s*(?<name>.*)")]
    private static partial Regex BuildChapterTitleRegex();

    [GeneratedRegex("第(?:[一二三四五六七八九十百千万零壹贰叁肆伍陆柒捌玖拾佰仟萬两兩〇]+|\\d+)(?:章节|章)")]
    private static partial Regex BuildChapterTitleDetectRegex();

    [GeneratedRegex("^Chapter\\s*(\\d+)", RegexOptions.IgnoreCase)]
    private static partial Regex BuildEnglishChapterRegex();

    [GeneratedRegex("^(序章|楔子|番外|后记|尾声|引子|终章|大结局)([：:.]?\\s*.*)?$")]
    private static partial Regex BuildSpecialChapterRegex();

    [GeneratedRegex("(?:从)?第?\\s*(?<start>[一二三四五六七八九十百千万零壹贰叁肆伍陆柒捌玖拾佰仟萬两兩〇]+|\\d+)\\s*(?:章节|章)?\\s*(?:[-~到至])\\s*第?\\s*(?<end>[一二三四五六七八九十百千万零壹贰叁肆伍陆柒捌玖拾佰仟萬两兩〇]+|\\d+)\\s*(?:章节|章)")]
    private static partial Regex BuildRangeRegex();

    [GeneratedRegex("第?\\s*(?<num>[一二三四五六七八九十百千万零壹贰叁肆伍陆柒捌玖拾佰仟萬两兩〇]+|\\d+)\\s*(?:章节|章)")]
    private static partial Regex BuildChapterTokenRegex();
}
