using FluentAssertions;
using TM.Web.Application.Dtos.Design;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Infrastructure.Services.Design;
using Xunit;

namespace TM.Web.Tests;

public class ChapterPlanSummaryRewriteTests
{
    [Fact]
    public async Task RewriteSummariesAsync_rewrites_current_scope_without_changing_titles()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        db.ChapterPlans.AddRange(
            new ChapterPlan
            {
                Name = "第1章计划",
                SourceBookId = "book-a",
                Category = "AI 开书",
                ChapterNumber = 1,
                ChapterTitle = "白僵夜袭",
                Volume = "第一卷 觉醒试炼",
                ChapterTheme = "道士序列第 1 章，围绕“觉醒、打脸、建立道法克尸认知”推进：围绕阶段目标搜集线索、建立关系并暴露阻力。",
                MainGoal = "围绕阶段目标搜集线索、建立关系并暴露阻力。",
                ResistanceSource = "潮汐财团封锁真相，白僵群持续突袭。",
                KeyTurn = "关键角色或势力改变主角的行动路径。",
                Hook = "更高层级的阻力浮出水面。",
                ReferencedCharacterNames = new List<string> { "许易明", "沈栀" },
                ReferencedFactionNames = new List<string> { "潮汐财团" },
                ReferencedLocationNames = new List<string> { "第三潮汐塔" }
            },
            new ChapterPlan
            {
                Name = "第2章计划",
                SourceBookId = "book-a",
                Category = "AI 开书",
                ChapterNumber = 2,
                ChapterTitle = "符火失控",
                Volume = "第一卷 觉醒试炼",
                ChapterTheme = "道士序列第 2 章，围绕“觉醒、打脸、建立道法克尸认知”推进：围绕阶段目标搜集线索、建立关系并暴露阻力。",
                MainGoal = "围绕阶段目标搜集线索、建立关系并暴露阻力。",
                ResistanceSource = "尸气压制火焰效果。",
                KeyTurn = "原计划被反制，主角必须调整策略。",
                Hook = "防线出现缺口。",
                ReferencedCharacterNames = new List<string> { "沈栀" },
                ReferencedFactionNames = new List<string> { "火属学生团" },
                ReferencedLocationNames = new List<string> { "地下管道" }
            },
            new ChapterPlan
            {
                Name = "第3章计划",
                SourceBookId = "book-b",
                Category = "AI 开书",
                ChapterNumber = 3,
                ChapterTitle = "别的书",
                ChapterTheme = "不应该被改"
            });
        await db.SaveChangesAsync();

        var service = new ChapterPlanService(db);
        var result = await service.RewriteSummariesAsync(new DesignListQuery(SourceBookId: "book-a"), CancellationToken.None);

        result.UpdatedCount.Should().Be(2);
        result.Items.Select(x => x.ChapterTitle).Should().Equal("白僵夜袭", "符火失控");
        result.Items.Select(x => x.ChapterTheme).Should().OnlyContain(x => x.Contains("作为切口"));
        result.Items.Select(x => x.ChapterTheme).Distinct().Should().HaveCount(2);

        var untouched = db.ChapterPlans.Single(x => x.SourceBookId == "book-b");
        untouched.ChapterTheme.Should().Be("不应该被改");
    }
}
