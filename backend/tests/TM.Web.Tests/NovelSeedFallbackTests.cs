using FluentAssertions;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Infrastructure.Services.Generation;
using Xunit;

namespace TM.Web.Tests;

public class NovelSeedFallbackTests
{
    [Fact]
    public void Fallback_chapter_summaries_are_specific_across_adjacent_chapters()
    {
        var request = new NovelSeedRequest
        {
            VolumeCount = 1,
            ChaptersPerVolume = 100,
            InitialChapterPlanCount = 60
        };

        var summaries = NovelSeedService.BuildFallbackChapterSummariesForTest(request);

        summaries.Should().HaveCount(60);
        summaries.Select(RemoveChapterOrdinal).Distinct().Should().HaveCountGreaterThan(45);
        summaries.Where(x => x.Contains("围绕阶段目标搜集线索、建立关系并暴露阻力。"))
            .Should().HaveCountLessThan(3);
    }

    private static string RemoveChapterOrdinal(string value)
        => System.Text.RegularExpressions.Regex.Replace(value, @"第 \d+ 章", "第 N 章");
}
