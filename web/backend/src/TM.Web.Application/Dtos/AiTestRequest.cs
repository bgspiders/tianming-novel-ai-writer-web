namespace TM.Web.Application.Dtos;

public sealed class AiTestRequest
{
    public string RunId { get; set; } = string.Empty;

    public string Provider { get; set; } = "openai-compatible";

    public string Endpoint { get; set; } = string.Empty;

    public string ApiKey { get; set; } = string.Empty;

    public string Model { get; set; } = string.Empty;

    public string Prompt { get; set; } = string.Empty;

    public string? SystemPrompt { get; set; }

    public float? Temperature { get; set; }

    public int? MaxTokens { get; set; }
}
