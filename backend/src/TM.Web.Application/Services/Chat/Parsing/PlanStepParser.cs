using System.Text;
using System.Text.RegularExpressions;

namespace TM.Web.Application.Services.Chat.Parsing;

public static partial class PlanStepParser
{
    private static readonly Regex StepPattern = BuildStepPattern();

    public static IReadOnlyList<PlanStepPayload> Parse(string? content)
    {
        var result = new List<PlanStepDraft>();
        if (string.IsNullOrWhiteSpace(content))
        {
            return Array.Empty<PlanStepPayload>();
        }

        var currentIndex = 0;
        var currentDetail = new StringBuilder();

        foreach (var rawLine in content.Split('\n'))
        {
            var trimmed = rawLine.Trim();
            var match = StepPattern.Match(trimmed);

            if (match.Success)
            {
                SavePreviousStep(result, currentDetail);

                var indexText = FirstGroup(match, "arabic", "stepNumber", "ordinal");
                var title = CleanTitle(FirstGroup(match, "arabicTitle", "stepTitle", "ordinalTitle"));
                var index = ChineseNumberParser.Parse(indexText);

                if (index > 0 && !string.IsNullOrWhiteSpace(title))
                {
                    result.Add(new PlanStepDraft(index, title));
                    currentIndex = index;
                    currentDetail.Clear();
                    continue;
                }
            }

            if (currentIndex > 0)
            {
                if (trimmed.Length == 0)
                {
                    currentDetail.AppendLine();
                }
                else
                {
                    currentDetail.AppendLine(trimmed);
                }
            }
        }

        SavePreviousStep(result, currentDetail);
        return result
            .OrderBy(step => step.Index)
            .Select(ToPayload)
            .ToList();
    }

    public static int CountSteps(string? content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return 0;
        }

        if (!content.Contains("步骤")
            && !content.Contains("计划")
            && !content.Contains("Step", StringComparison.OrdinalIgnoreCase)
            && !content.Contains("**目标**")
            && !Regex.IsMatch(content, @"^\s*\d+[\.、]", RegexOptions.Multiline))
        {
            return 0;
        }

        return content.Split('\n').Count(line => StepPattern.IsMatch(line.Trim()));
    }

    private static void SavePreviousStep(List<PlanStepDraft> result, StringBuilder detail)
    {
        if (result.Count > 0)
        {
            result[^1].Detail = detail.ToString().Trim();
        }
    }

    private static PlanStepPayload ToPayload(PlanStepDraft step)
    {
        var (chapterNumber, _) = ChapterReferenceParser.ExtractChapterParts(step.Title);
        return new PlanStepPayload(
            step.Index,
            step.Title,
            step.Detail,
            chapterNumber,
            ChapterDirectiveParser.ParseSourceChapterId(step.Detail),
            ChapterDirectiveParser.ParseTargetChapterId(step.Detail));
    }

    private static string CleanTitle(string title)
        => title.Replace("**", string.Empty).Trim();

    private static string FirstGroup(Match match, params string[] names)
    {
        foreach (var name in names)
        {
            var value = match.Groups[name].Value;
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return string.Empty;
    }

    [GeneratedRegex(
        @"^[\*\s]*\*?\*?(?:(?<arabic>\d+)[\.、\):：]\s*(?<arabicTitle>.+)|(?:步骤|Step|STEP)\s*(?<stepNumber>\d+|[一二三四五六七八九十百千万零壹贰叁肆伍陆柒捌玖拾佰仟萬两兩〇]+)[：:\s]+(?<stepTitle>.+)|第\s*(?<ordinal>\d+|[一二三四五六七八九十百千万零壹贰叁肆伍陆柒捌玖拾佰仟萬两兩〇]+)\s*步[：:\s]+(?<ordinalTitle>.+))\*?\*?\s*$",
        RegexOptions.IgnoreCase)]
    private static partial Regex BuildStepPattern();

    private sealed class PlanStepDraft
    {
        public PlanStepDraft(int index, string title)
        {
            Index = index;
            Title = title;
        }

        public int Index { get; }
        public string Title { get; }
        public string Detail { get; set; } = string.Empty;
    }
}
