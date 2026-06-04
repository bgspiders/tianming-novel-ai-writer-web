using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TM.Web.Domain.Entities.Generate;

namespace TM.Web.Infrastructure.Persistence.Configurations;

public class OutlineConfiguration : IEntityTypeConfiguration<Outline>
{
    public void Configure(EntityTypeBuilder<Outline> b)
    {
        b.ToTable("outlines");
        BusinessDataConfigurations.ApplyDefaults(b);

        b.Property(x => x.DependencyModuleVersions)
            .HasConversion(JsonValueConverters.StringIntDictionary)
            .Metadata.SetValueComparer(JsonValueConverters.StringIntDictionaryComparer);
    }
}

public class VolumeDesignConfiguration : IEntityTypeConfiguration<VolumeDesign>
{
    public void Configure(EntityTypeBuilder<VolumeDesign> b)
    {
        b.ToTable("volume_designs");
        BusinessDataConfigurations.ApplyDefaults(b);
        b.HasIndex(x => x.VolumeNumber);

        b.Property(x => x.DependencyModuleVersions)
            .HasConversion(JsonValueConverters.StringIntDictionary)
            .Metadata.SetValueComparer(JsonValueConverters.StringIntDictionaryComparer);
        b.Property(x => x.ReferencedCharacterNames)
            .HasConversion(JsonValueConverters.StringList)
            .Metadata.SetValueComparer(JsonValueConverters.StringListComparer);
        b.Property(x => x.ReferencedFactionNames)
            .HasConversion(JsonValueConverters.StringList)
            .Metadata.SetValueComparer(JsonValueConverters.StringListComparer);
        b.Property(x => x.ReferencedLocationNames)
            .HasConversion(JsonValueConverters.StringList)
            .Metadata.SetValueComparer(JsonValueConverters.StringListComparer);
    }
}

public class ChapterPlanConfiguration : IEntityTypeConfiguration<ChapterPlan>
{
    public void Configure(EntityTypeBuilder<ChapterPlan> b)
    {
        b.ToTable("chapter_plans");
        BusinessDataConfigurations.ApplyDefaults(b);
        b.HasIndex(x => x.ChapterNumber);

        b.Property(x => x.DependencyModuleVersions)
            .HasConversion(JsonValueConverters.StringIntDictionary)
            .Metadata.SetValueComparer(JsonValueConverters.StringIntDictionaryComparer);
        b.Property(x => x.AllowedEntities)
            .HasConversion(JsonValueConverters.StringList)
            .Metadata.SetValueComparer(JsonValueConverters.StringListComparer);
        b.Property(x => x.ReferencedCharacterNames)
            .HasConversion(JsonValueConverters.StringList)
            .Metadata.SetValueComparer(JsonValueConverters.StringListComparer);
        b.Property(x => x.ReferencedFactionNames)
            .HasConversion(JsonValueConverters.StringList)
            .Metadata.SetValueComparer(JsonValueConverters.StringListComparer);
        b.Property(x => x.ReferencedLocationNames)
            .HasConversion(JsonValueConverters.StringList)
            .Metadata.SetValueComparer(JsonValueConverters.StringListComparer);
    }
}

public class ChapterBlueprintConfiguration : IEntityTypeConfiguration<ChapterBlueprint>
{
    public void Configure(EntityTypeBuilder<ChapterBlueprint> b)
    {
        b.ToTable("chapter_blueprints");
        BusinessDataConfigurations.ApplyDefaults(b);
        b.Property(x => x.ChapterId).HasMaxLength(64);
        b.HasIndex(x => new { x.ChapterId, x.SceneNumber });

        b.Property(x => x.DependencyModuleVersions)
            .HasConversion(JsonValueConverters.StringIntDictionary)
            .Metadata.SetValueComparer(JsonValueConverters.StringIntDictionaryComparer);
    }
}
