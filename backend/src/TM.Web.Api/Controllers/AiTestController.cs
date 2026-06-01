using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos;
using TM.Web.Application.Services;
using TM.Web.Infrastructure.Persistence;
using TM.Web.Application.Security;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/ai")]
public sealed class AiTestController : ControllerBase
{
    private readonly IAiCompletionService _ai;
    private readonly AppDbContext _db;
    private readonly IKeyProtector _keyProtector;

    public AiTestController(IAiCompletionService ai, AppDbContext db, IKeyProtector keyProtector)
    {
        _ai = ai;
        _db = db;
        _keyProtector = keyProtector;
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
        if (string.IsNullOrWhiteSpace(request.ApiKey) && !string.IsNullOrWhiteSpace(request.ConfigId))
        {
            var keyEntity = await _db.AiApiKeys
                .Where(k => k.ProviderId == request.ConfigId && k.IsEnabled)
                .OrderBy(k => k.RotationOrder)
                .ThenBy(k => k.Name)
                .FirstOrDefaultAsync(ct);

            if (keyEntity is not null)
            {
                request.ApiKey = _keyProtector.Decrypt(keyEntity.EncryptedKey, keyEntity.Iv);
            }
        }

        var result = await _ai.StreamAsync(request, ct);
        return Ok(result);
    }
}
