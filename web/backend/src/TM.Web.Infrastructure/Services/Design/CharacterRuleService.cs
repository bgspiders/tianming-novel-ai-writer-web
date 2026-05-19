using Microsoft.EntityFrameworkCore;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Services;
using TM.Web.Domain.Entities.Design;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Infrastructure.Services.Design;

public class CharacterRuleService : ICharacterRuleService
{
    private readonly AppDbContext _db;
    public CharacterRuleService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<CharacterRuleDto>> ListAsync(DesignListQuery query, CancellationToken ct = default)
    {
        var rows = await _db.CharacterRules.AsQueryable().ApplyFilter(query).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<CharacterRuleDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.CharacterRules.FindAsync(new object?[] { id }, ct);
        return e == null ? null : Map(e);
    }

    public async Task<CharacterRuleDto> CreateAsync(CharacterRuleUpsertDto input, CancellationToken ct = default)
    {
        var e = new CharacterRule();
        Apply(e, input);
        _db.CharacterRules.Add(e);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task<CharacterRuleDto> UpdateAsync(string id, CharacterRuleUpsertDto input, CancellationToken ct = default)
    {
        var e = await _db.CharacterRules.FindAsync(new object?[] { id }, ct)
                ?? throw new InvalidOperationException("角色规则不存在。");
        Apply(e, input);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var e = await _db.CharacterRules.FindAsync(new object?[] { id }, ct);
        if (e == null) return;
        _db.CharacterRules.Remove(e);
        await _db.SaveChangesAsync(ct);
    }

    private static void Apply(CharacterRule e, CharacterRuleUpsertDto i)
    {
        if (string.IsNullOrWhiteSpace(i.Name)) throw new InvalidOperationException("名称必填。");
        e.Name = i.Name.Trim();
        e.Category = i.Category ?? "";
        e.CategoryId = string.IsNullOrEmpty(i.CategoryId) ? null : i.CategoryId;
        e.IsEnabled = i.IsEnabled;
        e.SourceBookId = string.IsNullOrEmpty(i.SourceBookId) ? null : i.SourceBookId;
        e.CharacterType = i.CharacterType ?? "";
        e.Gender = i.Gender ?? "";
        e.Age = i.Age ?? "";
        e.Identity = i.Identity ?? "";
        e.Race = i.Race ?? "";
        e.Appearance = i.Appearance ?? "";
        e.Want = i.Want ?? "";
        e.Need = i.Need ?? "";
        e.FlawBelief = i.FlawBelief ?? "";
        e.GrowthPath = i.GrowthPath ?? "";
        e.TargetCharacterName = i.TargetCharacterName ?? "";
        e.RelationshipType = i.RelationshipType ?? "";
        e.EmotionDynamic = i.EmotionDynamic ?? "";
        e.CombatSkills = i.CombatSkills ?? "";
        e.NonCombatSkills = i.NonCombatSkills ?? "";
        e.SpecialAbilities = i.SpecialAbilities ?? "";
        e.SignatureItems = i.SignatureItems ?? "";
        e.CommonItems = i.CommonItems ?? "";
        e.PersonalAssets = i.PersonalAssets ?? "";
    }

    private static CharacterRuleDto Map(CharacterRule e)
        => new(e.Id, e.Name, e.Category, e.CategoryId, e.IsEnabled, e.SourceBookId,
            e.CharacterType, e.Gender, e.Age, e.Identity, e.Race, e.Appearance,
            e.Want, e.Need, e.FlawBelief, e.GrowthPath,
            e.TargetCharacterName, e.RelationshipType, e.EmotionDynamic,
            e.CombatSkills, e.NonCombatSkills, e.SpecialAbilities,
            e.SignatureItems, e.CommonItems, e.PersonalAssets,
            e.CreatedAt, e.UpdatedAt);
}
