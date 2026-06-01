namespace TM.Web.Application.Services.Chat.Parsing;

public static class ChineseNumberParser
{
    private static readonly Dictionary<char, int> DigitMap = new()
    {
        ['零'] = 0, ['〇'] = 0,
        ['一'] = 1, ['壹'] = 1,
        ['二'] = 2, ['两'] = 2, ['兩'] = 2, ['贰'] = 2, ['貳'] = 2,
        ['三'] = 3, ['叁'] = 3, ['參'] = 3,
        ['四'] = 4, ['肆'] = 4,
        ['五'] = 5, ['伍'] = 5,
        ['六'] = 6, ['陆'] = 6, ['陸'] = 6,
        ['七'] = 7, ['柒'] = 7,
        ['八'] = 8, ['捌'] = 8,
        ['九'] = 9, ['玖'] = 9
    };

    private static readonly Dictionary<char, int> UnitMap = new()
    {
        ['十'] = 10, ['拾'] = 10,
        ['百'] = 100, ['佰'] = 100,
        ['千'] = 1000, ['仟'] = 1000,
        ['万'] = 10000, ['萬'] = 10000
    };

    public static int Parse(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return 0;
        }

        input = input.Trim();
        return int.TryParse(input, out var number) ? number : ParseChineseNumber(input);
    }

    public static bool TryParse(string? input, out int result)
    {
        result = Parse(input);
        return result > 0 || input is "零" or "〇" or "0";
    }

    private static int ParseChineseNumber(string chinese)
    {
        var result = 0;
        var temp = 0;
        var section = 0;
        var arabicBuffer = 0;
        var hasArabic = false;

        foreach (var c in chinese)
        {
            if (c is >= '0' and <= '9')
            {
                arabicBuffer = arabicBuffer * 10 + c - '0';
                hasArabic = true;
                continue;
            }

            if (DigitMap.TryGetValue(c, out var digit))
            {
                if (hasArabic)
                {
                    temp = arabicBuffer;
                    arabicBuffer = 0;
                    hasArabic = false;
                }

                temp = digit;
                continue;
            }

            if (!UnitMap.TryGetValue(c, out var unit))
            {
                continue;
            }

            if (hasArabic)
            {
                temp = arabicBuffer;
                arabicBuffer = 0;
                hasArabic = false;
            }

            if (unit == 10000)
            {
                section += temp == 0 ? 1 : temp;
                result += section * 10000;
                section = 0;
                temp = 0;
            }
            else
            {
                section += (temp == 0 ? 1 : temp) * unit;
                temp = 0;
            }
        }

        if (hasArabic)
        {
            temp = arabicBuffer;
        }

        return result + section + temp;
    }
}
