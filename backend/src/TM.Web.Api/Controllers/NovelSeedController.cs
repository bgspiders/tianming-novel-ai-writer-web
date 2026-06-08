using Microsoft.AspNetCore.Mvc;
using TM.Web.Application.Dtos.Generate;
using TM.Web.Application.Services;

namespace TM.Web.Api.Controllers;

[ApiController]
[Route("api/novel-seed")]
public sealed class NovelSeedController : ControllerBase
{
    private readonly INovelSeedService _novelSeed;
    private readonly INovelSeedWorkflowService _workflows;

    public NovelSeedController(INovelSeedService novelSeed, INovelSeedWorkflowService workflows)
    {
        _novelSeed = novelSeed;
        _workflows = workflows;
    }

    [HttpGet("plans")]
    public Task<IReadOnlyList<NovelSeedPlanSummaryDto>> ListPlans(CancellationToken ct)
        => _novelSeed.ListPlansAsync(ct);

    [HttpPost("plans/{projectId}/conversation")]
    public Task<NovelSeedConversationDto> GetOrCreateConversation(
        string projectId,
        [FromQuery] string? providerId,
        [FromQuery] string? modelCode,
        CancellationToken ct)
        => _novelSeed.GetOrCreateConversationAsync(projectId, providerId, modelCode, ct);

    [HttpPost]
    public Task<NovelSeedResult> Generate([FromBody] NovelSeedRequest request, CancellationToken ct)
        => _novelSeed.GenerateAsync(request, ct);

    [HttpPost("workflows")]
    public Task<NovelSeedWorkflowDto> CreateWorkflow([FromBody] NovelSeedWorkflowCreateRequest request, CancellationToken ct)
        => _workflows.CreateAsync(request, ct);

    [HttpPut("workflows/{workflowId}/request")]
    public Task<NovelSeedWorkflowDto> UpdateWorkflowRequest(
        string workflowId,
        [FromBody] NovelSeedWorkflowUpdateRequest request,
        CancellationToken ct)
        => _workflows.UpdateRequestAsync(workflowId, request, ct);

    [HttpGet("workflows")]
    public Task<IReadOnlyList<NovelSeedWorkflowDto>> ListWorkflows([FromQuery] int take, CancellationToken ct)
        => _workflows.ListAsync(take <= 0 ? 20 : take, ct);

    [HttpGet("workflows/{workflowId}")]
    public async Task<ActionResult<NovelSeedWorkflowDto>> GetWorkflow(string workflowId, CancellationToken ct)
    {
        var workflow = await _workflows.GetAsync(workflowId, ct);
        return workflow == null ? NotFound() : Ok(workflow);
    }

    [HttpPost("workflows/{workflowId}/steps/{stepKey}/run")]
    public Task<NovelSeedWorkflowStepDto> RunWorkflowStep(string workflowId, string stepKey, CancellationToken ct)
        => _workflows.RunStepAsync(workflowId, stepKey, ct);

    [HttpPost("workflows/{workflowId}/steps/{stepKey}/confirm")]
    public Task<NovelSeedWorkflowStepDto> ConfirmWorkflowStep(
        string workflowId,
        string stepKey,
        [FromQuery] bool confirmed,
        CancellationToken ct)
        => _workflows.ConfirmStepAsync(workflowId, stepKey, confirmed, ct);

    [HttpGet("workflows/{workflowId}/steps/{stepKey}/preview")]
    public Task<NovelSeedWorkflowStepPreviewDto> PreviewWorkflowStep(
        string workflowId,
        string stepKey,
        CancellationToken ct)
        => _workflows.GetStepPreviewAsync(workflowId, stepKey, ct);

    [HttpPost("workflows/{workflowId}/steps/{stepKey}/rewrite")]
    public Task<NovelSeedWorkflowStepDto> RewriteWorkflowStepFragment(
        string workflowId,
        string stepKey,
        [FromBody] NovelSeedWorkflowStepRewriteRequest request,
        CancellationToken ct)
        => _workflows.RewriteStepFragmentAsync(workflowId, stepKey, request, ct);

    [HttpDelete("workflows/{workflowId}")]
    public Task DeleteWorkflow(string workflowId, CancellationToken ct)
        => _workflows.DeleteAsync(workflowId, ct);
}
