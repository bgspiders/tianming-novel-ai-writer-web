using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/ai")]
public sealed class AiTestController : ControllerBase
{
    private readonly IAiCompletionService _ai;

    public AiTestController(IAiCompletionService ai)
    {
        _ai = ai;
    }

    /// <summary>
    /// 触发一次 AI 流式调用。
    /// 调用方需要先在 SignalR ChatHub 上 invoke("JoinRun", runId)，
    /// 流式 token 会以 "ReceiveToken" 事件推到该 runId 分组。
    /// 本 HTTP 接口仅返回执行元数据（chunkCount/charCount/finishReason/elapsedMs）。
    /// </summary>
    [HttpPost("test-completion")]
    [ProducesResponseType(typeof(AiTestResult), StatusCodes.Status200OK)]
    public async Task<ActionResult<AiTestResult>> TestCompletion(
        [FromBody] AiTestRequest request,
        CancellationToken ct)
    {
        var result = await _ai.StreamAsync(request, ct);
        return Ok(result);
    }
}
