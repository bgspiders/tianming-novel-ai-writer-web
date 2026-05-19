using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TM.Web.Domain.Common;
using TM.Web.Domain.Entities.Design;

namespace TM.Web.Infrastructure.Persistence.Configurations;

/// <summary>
/// 设计层共享配置：所有 BusinessDataBase 子类都按相同的 Id/Name/Category/SourceBookId 约束。
/// </summary>
internal static class BusinessDataConfigurations
{
    public static void ApplyDefaults<T>(EntityTypeBuilder<T> b) where T : BusinessDataBase
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.Name).IsRequired().HasMaxLength(256);
        b.Property(x => x.Category).HasMaxLength(128);
        b.Property(x => x.CategoryId).HasMaxLength(64);
        b.Property(x => x.SourceBookId).HasMaxLength(64);
        b.HasIndex(x => x.CategoryId);
        b.HasIndex(x => x.SourceBookId);
        b.HasIndex(x => x.Name);
    }
}

public class WorldRuleConfiguration : IEntityTypeConfiguration<WorldRule>
{
    public void Configure(EntityTypeBuilder<WorldRule> b)
    {
        b.ToTable("world_rules");
        BusinessDataConfigurations.ApplyDefaults(b);
    }
}

public class CharacterRuleConfiguration : IEntityTypeConfiguration<CharacterRule>
{
    public void Configure(EntityTypeBuilder<CharacterRule> b)
    {
        b.ToTable("character_rules");
        BusinessDataConfigurations.ApplyDefaults(b);
        b.Property(x => x.CharacterType).HasMaxLength(64);
        b.Property(x => x.Gender).HasMaxLength(32);
        b.Property(x => x.Age).HasMaxLength(64);
    }
}

public class FactionRuleConfiguration : IEntityTypeConfiguration<FactionRule>
{
    public void Configure(EntityTypeBuilder<FactionRule> b)
    {
        b.ToTable("faction_rules");
        BusinessDataConfigurations.ApplyDefaults(b);
        b.Property(x => x.FactionType).HasMaxLength(64);
    }
}

public class LocationRuleConfiguration : IEntityTypeConfiguration<LocationRule>
{
    public void Configure(EntityTypeBuilder<LocationRule> b)
    {
        b.ToTable("location_rules");
        BusinessDataConfigurations.ApplyDefaults(b);
        b.Property(x => x.LocationType).HasMaxLength(64);
        b.Property(x => x.FactionId).HasMaxLength(64);
        b.HasIndex(x => x.FactionId);

        b.Property(x => x.Landmarks)
            .HasConversion(JsonValueConverters.StringList)
            .Metadata.SetValueComparer(JsonValueConverters.StringListComparer);
        b.Property(x => x.Resources)
            .HasConversion(JsonValueConverters.StringList)
            .Metadata.SetValueComparer(JsonValueConverters.StringListComparer);
        b.Property(x => x.Dangers)
            .HasConversion(JsonValueConverters.StringList)
            .Metadata.SetValueComparer(JsonValueConverters.StringListComparer);
    }
}

public class PlotRuleConfiguration : IEntityTypeConfiguration<PlotRule>
{
    public void Configure(EntityTypeBuilder<PlotRule> b)
    {
        b.ToTable("plot_rules");
        BusinessDataConfigurations.ApplyDefaults(b);
        b.Property(x => x.EventType).HasMaxLength(64);
        b.Property(x => x.StoryPhase).HasMaxLength(64);
    }
}

public class CreativeMaterialConfiguration : IEntityTypeConfiguration<CreativeMaterial>
{
    public void Configure(EntityTypeBuilder<CreativeMaterial> b)
    {
        b.ToTable("creative_materials");
        BusinessDataConfigurations.ApplyDefaults(b);
        b.Property(x => x.Icon).HasMaxLength(16);
        b.Property(x => x.Genre).HasMaxLength(64);
        b.Property(x => x.SourceBookName).HasMaxLength(256);
    }
}

public class BookAnalysisConfiguration : IEntityTypeConfiguration<BookAnalysis>
{
    public void Configure(EntityTypeBuilder<BookAnalysis> b)
    {
        b.ToTable("book_analyses");
        BusinessDataConfigurations.ApplyDefaults(b);
        b.Property(x => x.Icon).HasMaxLength(16);
        b.Property(x => x.Genre).HasMaxLength(64);
        b.Property(x => x.Author).HasMaxLength(128);
        b.Property(x => x.SourceUrl).HasMaxLength(1024);
        b.Property(x => x.SourceBookTitle).HasMaxLength(256);
        b.Property(x => x.SourceAuthor).HasMaxLength(128);
        b.Property(x => x.SourceSite).HasMaxLength(128);
    }
}
