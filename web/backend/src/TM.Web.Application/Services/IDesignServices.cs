using TM.Web.Application.Dtos.Design;

namespace TM.Web.Application.Services;

public interface IWorldRuleService
{
    Task<IReadOnlyList<WorldRuleDto>> ListAsync(DesignListQuery query, CancellationToken ct = default);
    Task<PagedResult<WorldRuleDto>> ListPagedAsync(DesignListQuery query, CancellationToken ct = default);
    Task<WorldRuleDto?> GetAsync(string id, CancellationToken ct = default);
    Task<WorldRuleDto> CreateAsync(WorldRuleUpsertDto input, CancellationToken ct = default);
    Task<WorldRuleDto> UpdateAsync(string id, WorldRuleUpsertDto input, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}

public interface ICharacterRuleService
{
    Task<IReadOnlyList<CharacterRuleDto>> ListAsync(DesignListQuery query, CancellationToken ct = default);
    Task<PagedResult<CharacterRuleDto>> ListPagedAsync(DesignListQuery query, CancellationToken ct = default);
    Task<CharacterRuleDto?> GetAsync(string id, CancellationToken ct = default);
    Task<CharacterRuleDto> CreateAsync(CharacterRuleUpsertDto input, CancellationToken ct = default);
    Task<CharacterRuleDto> UpdateAsync(string id, CharacterRuleUpsertDto input, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}

public interface IFactionRuleService
{
    Task<IReadOnlyList<FactionRuleDto>> ListAsync(DesignListQuery query, CancellationToken ct = default);
    Task<PagedResult<FactionRuleDto>> ListPagedAsync(DesignListQuery query, CancellationToken ct = default);
    Task<FactionRuleDto?> GetAsync(string id, CancellationToken ct = default);
    Task<FactionRuleDto> CreateAsync(FactionRuleUpsertDto input, CancellationToken ct = default);
    Task<FactionRuleDto> UpdateAsync(string id, FactionRuleUpsertDto input, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}

public interface ILocationRuleService
{
    Task<IReadOnlyList<LocationRuleDto>> ListAsync(DesignListQuery query, CancellationToken ct = default);
    Task<PagedResult<LocationRuleDto>> ListPagedAsync(DesignListQuery query, CancellationToken ct = default);
    Task<LocationRuleDto?> GetAsync(string id, CancellationToken ct = default);
    Task<LocationRuleDto> CreateAsync(LocationRuleUpsertDto input, CancellationToken ct = default);
    Task<LocationRuleDto> UpdateAsync(string id, LocationRuleUpsertDto input, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}

public interface IPlotRuleService
{
    Task<IReadOnlyList<PlotRuleDto>> ListAsync(DesignListQuery query, CancellationToken ct = default);
    Task<PagedResult<PlotRuleDto>> ListPagedAsync(DesignListQuery query, CancellationToken ct = default);
    Task<PlotRuleDto?> GetAsync(string id, CancellationToken ct = default);
    Task<PlotRuleDto> CreateAsync(PlotRuleUpsertDto input, CancellationToken ct = default);
    Task<PlotRuleDto> UpdateAsync(string id, PlotRuleUpsertDto input, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}

public interface ICreativeMaterialService
{
    Task<IReadOnlyList<CreativeMaterialDto>> ListAsync(DesignListQuery query, CancellationToken ct = default);
    Task<PagedResult<CreativeMaterialDto>> ListPagedAsync(DesignListQuery query, CancellationToken ct = default);
    Task<CreativeMaterialDto?> GetAsync(string id, CancellationToken ct = default);
    Task<CreativeMaterialDto> CreateAsync(CreativeMaterialUpsertDto input, CancellationToken ct = default);
    Task<CreativeMaterialDto> UpdateAsync(string id, CreativeMaterialUpsertDto input, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}

public interface IBookAnalysisService
{
    Task<IReadOnlyList<BookAnalysisDto>> ListAsync(DesignListQuery query, CancellationToken ct = default);
    Task<PagedResult<BookAnalysisDto>> ListPagedAsync(DesignListQuery query, CancellationToken ct = default);
    Task<BookAnalysisDto?> GetAsync(string id, CancellationToken ct = default);
    Task<BookAnalysisDto> CreateAsync(BookAnalysisUpsertDto input, CancellationToken ct = default);
    Task<BookAnalysisDto> UpdateAsync(string id, BookAnalysisUpsertDto input, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}

public interface IOutlineService
{
    Task<IReadOnlyList<OutlineDto>> ListAsync(DesignListQuery query, CancellationToken ct = default);
    Task<PagedResult<OutlineDto>> ListPagedAsync(DesignListQuery query, CancellationToken ct = default);
    Task<OutlineDto?> GetAsync(string id, CancellationToken ct = default);
    Task<OutlineDto> CreateAsync(OutlineUpsertDto input, CancellationToken ct = default);
    Task<OutlineDto> UpdateAsync(string id, OutlineUpsertDto input, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}

public interface IVolumeDesignService
{
    Task<IReadOnlyList<VolumeDesignDto>> ListAsync(DesignListQuery query, CancellationToken ct = default);
    Task<PagedResult<VolumeDesignDto>> ListPagedAsync(DesignListQuery query, CancellationToken ct = default);
    Task<VolumeDesignDto?> GetAsync(string id, CancellationToken ct = default);
    Task<VolumeDesignDto> CreateAsync(VolumeDesignUpsertDto input, CancellationToken ct = default);
    Task<VolumeDesignDto> UpdateAsync(string id, VolumeDesignUpsertDto input, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}

public interface IChapterPlanService
{
    Task<IReadOnlyList<ChapterPlanDto>> ListAsync(DesignListQuery query, CancellationToken ct = default);
    Task<PagedResult<ChapterPlanDto>> ListPagedAsync(DesignListQuery query, CancellationToken ct = default);
    Task<ChapterPlanDto?> GetAsync(string id, CancellationToken ct = default);
    Task<ChapterPlanDto> CreateAsync(ChapterPlanUpsertDto input, CancellationToken ct = default);
    Task<ChapterPlanDto> UpdateAsync(string id, ChapterPlanUpsertDto input, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}

public interface IChapterBlueprintService
{
    Task<IReadOnlyList<ChapterBlueprintDto>> ListAsync(DesignListQuery query, CancellationToken ct = default);
    Task<PagedResult<ChapterBlueprintDto>> ListPagedAsync(DesignListQuery query, CancellationToken ct = default);
    Task<ChapterBlueprintDto?> GetAsync(string id, CancellationToken ct = default);
    Task<ChapterBlueprintDto> CreateAsync(ChapterBlueprintUpsertDto input, CancellationToken ct = default);
    Task<ChapterBlueprintDto> UpdateAsync(string id, ChapterBlueprintUpsertDto input, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}
