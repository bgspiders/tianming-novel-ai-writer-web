using System.Text;

namespace TM.Web.Application.Services.Chat.Parsing;

public static class PlanStepNormalizer
{
    public static PlanParseResult Normalize(string? userInput, string? rawContent, IReadOnlyList<PlanStepPayload>? parsedSteps)
    {
        var steps = parsedSteps ?? Array.Empty<PlanStepPayload>();
        if (steps.Count == 0)
        {
            return new PlanParseResult(steps);
        }

        if (ChapterReferenceParser.IsSingleChapterTask(userInput))
        {
            return new PlanParseResult(MergeToSingleStep(steps), "singleChapterMerged");
        }

        var range = ChapterReferenceParser.ParseChapterRange(userInput);
        range ??= ChapterReferenceParser.ParseChapterRange(rawContent);
        if (range is { } chapterRange && chapterRange.End > chapterRange.Start)
        {
            return new PlanParseResult(
                SplitByChapterRange(chapterRange.Start, chapterRange.End, steps),
                "chapterRangeSplit",
                new ChapterRangePayload(chapterRange.Start, chapterRange.End));
        }

        var distinctChapters = ExtractDistinctChapters(steps);
        if (distinctChapters.Count >= 2)
        {
            return new PlanParseResult(steps, "multiChapterPreserved");
        }

        if (distinctChapters.Count == 1)
        {
            return new PlanParseResult(MergeToSingleStep(steps), steps.Count > 1 ? "singleChapterMerged" : null);
        }

        return new PlanParseResult(steps);
    }

    private static IReadOnlyList<PlanStepPayload> MergeToSingleStep(IReadOnlyList<PlanStepPayload> steps)
    {
        if (steps.Count <= 1)
        {
            return steps;
        }

        var chapterTitle = "生成章节";
        int? chapterNumber = null;

        foreach (var step in steps)
        {
            if (!ChapterReferenceParser.IsChapterTitle(step.Title))
            {
                continue;
            }

            var (number, name) = ChapterReferenceParser.ExtractChapterParts(step.Title);
            chapterNumber = number;
            if (number.HasValue)
            {
                chapterTitle = string.IsNullOrWhiteSpace(name)
                    ? $"第{number.Value}章"
                    : $"第{number.Value}章：{name}";
            }
            else
            {
                chapterTitle = step.Title.Trim();
            }

            break;
        }

        var sb = new StringBuilder();
        sb.AppendLine("AI 原始计划：");
        foreach (var step in steps)
        {
            sb.AppendLine($"{step.Index}. {step.Title}");
            if (!string.IsNullOrWhiteSpace(step.Detail))
            {
                sb.AppendLine(step.Detail);
            }
            sb.AppendLine();
        }

        var detail = sb.ToString().Trim();
        return
        [
            new PlanStepPayload(
                1,
                chapterTitle,
                detail,
                chapterNumber,
                ChapterDirectiveParser.ParseSourceChapterId(detail),
                ChapterDirectiveParser.ParseTargetChapterId(detail))
        ];
    }

    private static IReadOnlyList<PlanStepPayload> SplitByChapterRange(int startChapter, int endChapter, IReadOnlyList<PlanStepPayload> originalSteps)
    {
        var newSteps = new List<PlanStepPayload>();
        var originalContent = new StringBuilder();
        foreach (var step in originalSteps)
        {
            originalContent.AppendLine($"{step.Index}. {step.Title}");
            if (!string.IsNullOrWhiteSpace(step.Detail))
            {
                originalContent.AppendLine(step.Detail);
            }
        }

        var sharedDetail = originalContent.ToString().Trim();
        for (var chapterNum = startChapter; chapterNum <= endChapter; chapterNum++)
        {
            var index = chapterNum - startChapter + 1;
            newSteps.Add(new PlanStepPayload(
                index,
                $"第{chapterNum}章",
                index == 1
                    ? $"创作计划概要：\n{sharedDetail}"
                    : $"根据前文和大纲，生成第{chapterNum}章内容。",
                chapterNum));
        }

        return newSteps;
    }

    private static HashSet<string> ExtractDistinctChapters(IReadOnlyList<PlanStepPayload> steps)
    {
        var distinctChapters = new HashSet<string>();
        foreach (var step in steps)
        {
            var number = step.ChapterNumber;
            if (!number.HasValue && ChapterReferenceParser.IsChapterTitle(step.Title))
            {
                (number, _) = ChapterReferenceParser.ExtractChapterParts(step.Title);
            }

            if (number.HasValue)
            {
                distinctChapters.Add($"第{number.Value}章");
            }
        }

        return distinctChapters;
    }
}
