using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;

namespace TM.Web.LegacyBridge.Generation;

public sealed class LegacyGenerationGateService : IGenerationGateService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = false
    };

    private static readonly char[] TrimChars =
    [
        '"', '\'', '“', '”', '‘', '’', '[', ']', '【', '】', '「', '」',
        '『', '』', '(', ')', '（', '）', '。', '.', '，', ',', '：', ':',
        '；', ';', '、', ' ', '\t', '\r', '\n'
    ];

    public async Task<GenerationGateResultDto> ValidateAsync(GenerationGateRequest request, CancellationToken ct = default)
    {
        ct.ThrowIfCancellationRequested();
        await Task.CompletedTask;

        var failures = new List<GenerationGateFailureDto>();
        var content = request.RawContent ?? string.Empty;
        var contentWithoutChanges = StripChangeMarkers(content);

        if (string.IsNullOrWhiteSpace(contentWithoutChanges))
        {
            failures.Add(new GenerationGateFailureDto
            {
                Type = "Content",
                Errors = new List<string> { "生成内容为空。" }
            });
        }

        AddMissingNameFailures(failures, "Character", request.DesignElements?.CharacterNames, contentWithoutChanges, "角色");
        AddMissingNameFailures(failures, "Faction", request.DesignElements?.FactionNames, contentWithoutChanges, "势力");
        AddMissingNameFailures(failures, "Location", request.DesignElements?.LocationNames, contentWithoutChanges, "地点");
        AddMissingNameFailures(failures, "Plot", request.DesignElements?.PlotKeyNames, contentWithoutChanges, "情节关键词");

        return new GenerationGateResultDto
        {
            Success = failures.Count == 0,
            Failures = failures,
            FailureStages = failures.Select(f => f.Type).Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
            ContentWithoutChanges = contentWithoutChanges,
            ParsedChangesJson = JsonSerializer.Serialize(EmptyParsedChanges.Instance, JsonOptions),
            AllFailures = failures.SelectMany(f => f.Errors).ToList()
        };
    }

    private static void AddMissingNameFailures(
        List<GenerationGateFailureDto> failures,
        string type,
        IEnumerable<string>? names,
        string content,
        string label)
    {
        var normalizedContent = NormalizeForMatch(content);
        var missing = (names ?? Enumerable.Empty<string>())
            .Select(NormalizeExpectedValue)
            .Where(name => name.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Where(name => !IsCovered(normalizedContent, name))
            .Take(10)
            .Select(name => $"生成内容未覆盖{label}：{name}")
            .ToList();

        if (missing.Count == 0)
        {
            return;
        }

        failures.Add(new GenerationGateFailureDto
        {
            Type = type,
            Errors = missing
        });
    }

    private static string StripChangeMarkers(string content)
        => content.Replace("【变化记录】", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Replace("[ChangeLog]", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Trim();

    private static bool IsCovered(string normalizedContent, string expected)
    {
        var normalizedExpected = NormalizeForMatch(expected);
        if (normalizedExpected.Length == 0)
        {
            return true;
        }

        if (normalizedContent.Contains(normalizedExpected, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var tokens = ExtractMeaningfulTokens(expected)
            .Select(NormalizeForMatch)
            .Where(token => token.Length >= 2)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (tokens.Count == 0)
        {
            return false;
        }

        return tokens.Count(token => normalizedContent.Contains(token, StringComparison.OrdinalIgnoreCase))
            >= Math.Min(2, tokens.Count);
    }

    private static string NormalizeExpectedValue(string value)
    {
        var normalized = value.Trim(TrimChars);

        while (normalized.EndsWith(']') || normalized.EndsWith('"') || normalized.EndsWith('”'))
        {
            normalized = normalized[..^1].Trim(TrimChars);
        }

        return normalized;
    }

    private static string NormalizeForMatch(string value)
        => new(value.Where(ch => !char.IsWhiteSpace(ch) && !TrimChars.Contains(ch)).ToArray());

    private static IEnumerable<string> ExtractMeaningfulTokens(string value)
    {
        var cleaned = NormalizeExpectedValue(value);
        foreach (var token in Regex.Split(cleaned, @"[，,。；;、\s]+"))
        {
            var part = token.Trim(TrimChars);
            if (part.Length >= 2)
            {
                yield return part;
            }
        }

        foreach (var marker in new[] { "进入", "潜入", "转移", "发现", "抵达", "覆盖", "前往" })
        {
            var index = cleaned.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
            if (index >= 0)
            {
                var remainder = cleaned[(index + marker.Length)..].Trim(TrimChars);
                if (remainder.Length >= 2)
                {
                    yield return remainder;
                }
            }
        }

        foreach (Match match in Regex.Matches(cleaned, @"第?[一二三四五六七八九十0-9]+[^，,。；;\s]{1,8}"))
        {
            yield return match.Value;
        }

        foreach (Match match in Regex.Matches(cleaned, @"第?[一二三四五六七八九十0-9]+.{0,8}?[塔城站区层线]"))
        {
            yield return match.Value;
        }

        foreach (var marker in new[] { "潜入线", "转移", "发现", "抵达", "进入" })
        {
            if (cleaned.Contains(marker, StringComparison.OrdinalIgnoreCase))
            {
                yield return marker;
            }
        }
    }

    private sealed class EmptyParsedChanges
    {
        public static readonly EmptyParsedChanges Instance = new();

        public List<object> CharacterStateChanges { get; } = new();
        public List<object> ConflictProgress { get; } = new();
        public List<object> NewPlotPoints { get; } = new();
        public List<object> ForeshadowingActions { get; } = new();
        public List<object> LocationStateChanges { get; } = new();
        public List<object> FactionStateChanges { get; } = new();
        public object? TimeProgression { get; } = null;
        public List<object> CharacterMovements { get; } = new();
        public List<object> ItemTransfers { get; } = new();
    }
}
