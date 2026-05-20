using System.Threading;
using System.Threading.Tasks;
using TM.Web.Application.Dtos.Generate;

namespace TM.Web.Application.Services;

public interface IGenerationGateService
{
    Task<GenerationGateResultDto> ValidateAsync(GenerationGateRequest request, CancellationToken ct = default);
}
