namespace TM.Web.Application.Services.Chat.Parsing;

public static class ThinkingBlockParser
{
    public static IReadOnlyList<ThinkingBlockPayload> Parse(string? thinkingContent)
    {
        if (string.IsNullOrWhiteSpace(thinkingContent))
        {
            return Array.Empty<ThinkingBlockPayload>();
        }

        var blocks = new List<ThinkingBlockDraft>();
        var currentLines = new List<string>();
        string? currentTitle = null;

        foreach (var line in thinkingContent.Split('\n'))
        {
            var trimmed = line.TrimStart();
            if (IsHeadingLine(trimmed))
            {
                if (currentLines.Count > 0 || currentTitle is not null)
                {
                    AddBlock(currentTitle, currentLines, blocks);
                    currentLines.Clear();
                }

                currentTitle = ExtractTitle(trimmed);
            }
            else if (!string.IsNullOrWhiteSpace(line))
            {
                currentLines.Add(line);
            }
        }

        if (currentLines.Count > 0 || currentTitle is not null)
        {
            AddBlock(currentTitle, currentLines, blocks);
        }

        return blocks
            .Select((block, index) => new ThinkingBlockPayload(index + 1, block.Title, block.Body))
            .ToList();
    }

    private static bool IsHeadingLine(string trimmed)
    {
        if (string.IsNullOrEmpty(trimmed))
        {
            return false;
        }

        if (trimmed.StartsWith('#'))
        {
            return true;
        }

        if (trimmed.Length <= 20 && (trimmed.EndsWith('：') || trimmed.EndsWith(':')))
        {
            return true;
        }

        return trimmed.Length >= 3 && char.IsDigit(trimmed[0]) && trimmed[1] == '.';
    }

    private static string ExtractTitle(string line)
    {
        var trimmed = line.TrimStart();
        while (trimmed.StartsWith('#'))
        {
            trimmed = trimmed[1..];
        }

        return trimmed.TrimEnd('：', ':').Trim();
    }

    private static void AddBlock(string? title, IReadOnlyList<string> lines, ICollection<ThinkingBlockDraft> blocks)
    {
        var body = string.Join("\n", lines).Trim();
        if (string.IsNullOrWhiteSpace(title) && !string.IsNullOrWhiteSpace(body))
        {
            title = "分析";
        }

        if (!string.IsNullOrWhiteSpace(title) || !string.IsNullOrWhiteSpace(body))
        {
            blocks.Add(new ThinkingBlockDraft(title ?? string.Empty, body));
        }
    }

    private sealed record ThinkingBlockDraft(string Title, string Body);
}
