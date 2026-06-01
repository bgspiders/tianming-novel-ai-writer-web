using TM.Web.Domain.Common;

namespace TM.Web.Domain.Entities.Design;

/// <summary>
/// 剧情规则。16 字段对应原 PlotRulesData 4 Tab。
/// </summary>
public class PlotRule : BusinessDataBase
{
    // Tab1: 事件概览
    public string TargetVolume { get; set; } = string.Empty;
    public string AssignedVolume { get; set; } = string.Empty;
    public string OneLineSummary { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string StoryPhase { get; set; } = string.Empty;
    public string PrerequisitesTrigger { get; set; } = string.Empty;

    // Tab2: 参与方
    public string MainCharacters { get; set; } = string.Empty;
    public string KeyNpcs { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string TimeDuration { get; set; } = string.Empty;

    // Tab3: 情节流程
    public string StepTitle { get; set; } = string.Empty;
    public string Goal { get; set; } = string.Empty;
    public string Conflict { get; set; } = string.Empty;
    public string Result { get; set; } = string.Empty;
    public string EmotionCurve { get; set; } = string.Empty;

    // Tab4: 事件影响
    public string MainPlotPush { get; set; } = string.Empty;
    public string CharacterGrowth { get; set; } = string.Empty;
    public string WorldReveal { get; set; } = string.Empty;
    public string RewardsClues { get; set; } = string.Empty;
}
