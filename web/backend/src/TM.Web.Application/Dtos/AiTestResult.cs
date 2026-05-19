namespace TM.Web.Application.Dtos;

public sealed class AiTestResult
{
    public string RunId { get; set; } = string.Empty;

    public int ChunkCount { get; set; }

    public int CharCount { get; set; }

    public string? FinishReason { get; set; }

    public long ElapsedMs { get; set; }

    public string? Model { get; set; }
}
