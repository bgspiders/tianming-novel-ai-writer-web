using System.Text.RegularExpressions;

namespace TM.Web.Application.Services.Chat.Parsing;

public static partial class ChapterDirectiveParser
{
    private static readonly Regex ContinuePattern = ContinueRegex();
    private static readonly Regex RewritePattern = RewriteRegex();

    public static ChapterDirectivePayload? Parse(string? text)
    {
        var source = ParseSourceChapterId(text);
        if (!string.IsNullOrWhiteSpace(source))
        {
            return new ChapterDirectivePayload("continue", source);
        }

        var target = ParseTargetChapterId(text);
        return string.IsNullOrWhiteSpace(target)
            ? null
            : new ChapterDirectivePayload("rewrite", target);
    }

    public static string? ParseSourceChapterId(string? text)
        => ParseChapterId(text, ContinuePattern);

    public static string? ParseTargetChapterId(string? text)
        => ParseChapterId(text, RewritePattern);

    public static bool HasContinueDirective(string? text)
        => !string.IsNullOrWhiteSpace(text) && ContinuePattern.IsMatch(text);

    public static bool HasRewriteDirective(string? text)
        => !string.IsNullOrWhiteSpace(text) && RewritePattern.IsMatch(text);

    private static string? ParseChapterId(string? text, Regex pattern)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        var match = pattern.Match(text);
        if (!match.Success || match.Groups.Count <= 1)
        {
            return null;
        }

        var chapterId = match.Groups[1].Value.Trim().TrimEnd(',', '，', ';', '；', '.', '。');
        return string.IsNullOrWhiteSpace(chapterId) ? null : chapterId;
    }

    [GeneratedRegex(@"@(?:续写|continue)[:：\s]*(\S+)", RegexOptions.IgnoreCase)]
    private static partial Regex ContinueRegex();

    [GeneratedRegex(@"@(?:重写|rewrite)[:：\s]*(\S+)", RegexOptions.IgnoreCase)]
    private static partial Regex RewriteRegex();
}
