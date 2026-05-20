namespace TM.Web.Application.Dtos;

public sealed class AiTestResult
{
    public string RunId { get; set; } = string.Empty;

    public int ChunkCount { get; set; }

    public int CharCount { get; set; }

    public string? FinishReason { get; set; }

    public long ElapsedMs { get; set; }

    public string? Model { get; set; }

    /// <summary>
    /// 流式输出的完整正文。AI 测试页可忽略,生成服务用它做服务端保存与记录。
    /// </summary>
    public string? Content { get; set; }
}
