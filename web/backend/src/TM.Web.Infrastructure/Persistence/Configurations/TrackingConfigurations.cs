using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TM.Web.Domain.Entities.Tracking;

namespace TM.Web.Infrastructure.Persistence.Configurations;

public class CharacterStateEntryConfiguration : IEntityTypeConfiguration<CharacterStateEntry>
{
    public void Configure(EntityTypeBuilder<CharacterStateEntry> b)
    {
        b.ToTable("character_state_entries");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.CharacterId).IsRequired().HasMaxLength(64);
        b.Property(x => x.SourceBookId).HasMaxLength(64);
        b.Property(x => x.Name).IsRequired().HasMaxLength(256);
        b.HasIndex(x => new { x.ProjectId, x.CharacterId }).IsUnique();
        b.HasIndex(x => new { x.ProjectId, x.SourceBookId });

        b.Property(x => x.DriftWarnings)
            .HasConversion(JsonValueConverters.StringList)
            .Metadata.SetValueComparer(JsonValueConverters.StringListComparer);
    }
}

public class CharacterStatePointConfiguration : IEntityTypeConfiguration<CharacterStatePoint>
{
    public void Configure(EntityTypeBuilder<CharacterStatePoint> b)
    {
        b.ToTable("character_state_points");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.CharacterStateEntryId).IsRequired().HasMaxLength(64);
        b.Property(x => x.ChapterId).IsRequired().HasMaxLength(64);
        b.Property(x => x.Importance).HasMaxLength(32);
        b.HasIndex(x => new { x.CharacterStateEntryId, x.ChapterId });
        b.HasOne(x => x.CharacterStateEntry)
            .WithMany(e => e.StateHistory)
            .HasForeignKey(x => x.CharacterStateEntryId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Property(x => x.Abilities)
            .HasConversion(JsonValueConverters.StringList)
            .Metadata.SetValueComparer(JsonValueConverters.StringListComparer);
    }
}

public class CharacterRelationshipStateConfiguration : IEntityTypeConfiguration<CharacterRelationshipState>
{
    public void Configure(EntityTypeBuilder<CharacterRelationshipState> b)
    {
        b.ToTable("character_relationship_states");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.CharacterStateEntryId).IsRequired().HasMaxLength(64);
        b.Property(x => x.TargetCharacterName).IsRequired().HasMaxLength(256);
        b.Property(x => x.ChapterId).HasMaxLength(64);
        b.HasIndex(x => new { x.CharacterStateEntryId, x.TargetCharacterName, x.ChapterId });
        b.HasOne(x => x.CharacterStateEntry)
            .WithMany(e => e.Relationships)
            .HasForeignKey(x => x.CharacterStateEntryId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class FactionStateEntryConfiguration : IEntityTypeConfiguration<FactionStateEntry>
{
    public void Configure(EntityTypeBuilder<FactionStateEntry> b)
    {
        b.ToTable("faction_state_entries");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.FactionId).IsRequired().HasMaxLength(64);
        b.Property(x => x.SourceBookId).HasMaxLength(64);
        b.Property(x => x.Name).IsRequired().HasMaxLength(256);
        b.HasIndex(x => new { x.ProjectId, x.FactionId }).IsUnique();
    }
}

public class FactionStatePointConfiguration : IEntityTypeConfiguration<FactionStatePoint>
{
    public void Configure(EntityTypeBuilder<FactionStatePoint> b)
    {
        b.ToTable("faction_state_points");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.FactionStateEntryId).IsRequired().HasMaxLength(64);
        b.Property(x => x.ChapterId).IsRequired().HasMaxLength(64);
        b.HasIndex(x => new { x.FactionStateEntryId, x.ChapterId });
        b.HasOne(x => x.FactionStateEntry)
            .WithMany(e => e.StateHistory)
            .HasForeignKey(x => x.FactionStateEntryId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class LocationStateEntryConfiguration : IEntityTypeConfiguration<LocationStateEntry>
{
    public void Configure(EntityTypeBuilder<LocationStateEntry> b)
    {
        b.ToTable("location_state_entries");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.LocationId).IsRequired().HasMaxLength(64);
        b.Property(x => x.Name).IsRequired().HasMaxLength(256);
        b.HasIndex(x => new { x.ProjectId, x.LocationId }).IsUnique();
    }
}

public class LocationStatePointConfiguration : IEntityTypeConfiguration<LocationStatePoint>
{
    public void Configure(EntityTypeBuilder<LocationStatePoint> b)
    {
        b.ToTable("location_state_points");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.LocationStateEntryId).IsRequired().HasMaxLength(64);
        b.Property(x => x.ChapterId).IsRequired().HasMaxLength(64);
        b.HasIndex(x => new { x.LocationStateEntryId, x.ChapterId });
        b.HasOne(x => x.LocationStateEntry)
            .WithMany(e => e.StateHistory)
            .HasForeignKey(x => x.LocationStateEntryId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ItemStateEntryConfiguration : IEntityTypeConfiguration<ItemStateEntry>
{
    public void Configure(EntityTypeBuilder<ItemStateEntry> b)
    {
        b.ToTable("item_state_entries");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.Name).IsRequired().HasMaxLength(256);
        b.HasIndex(x => new { x.ProjectId, x.Name });
    }
}

public class ItemStatePointConfiguration : IEntityTypeConfiguration<ItemStatePoint>
{
    public void Configure(EntityTypeBuilder<ItemStatePoint> b)
    {
        b.ToTable("item_state_points");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ItemStateEntryId).IsRequired().HasMaxLength(64);
        b.Property(x => x.ChapterId).IsRequired().HasMaxLength(64);
        b.HasIndex(x => new { x.ItemStateEntryId, x.ChapterId });
        b.HasOne(x => x.ItemStateEntry)
            .WithMany(e => e.StateHistory)
            .HasForeignKey(x => x.ItemStateEntryId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ConflictProgressEntryConfiguration : IEntityTypeConfiguration<ConflictProgressEntry>
{
    public void Configure(EntityTypeBuilder<ConflictProgressEntry> b)
    {
        b.ToTable("conflict_progress_entries");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.Name).IsRequired().HasMaxLength(256);
        b.HasIndex(x => new { x.ProjectId, x.Name });

        b.Property(x => x.InvolvedChapters)
            .HasConversion(JsonValueConverters.StringList)
            .Metadata.SetValueComparer(JsonValueConverters.StringListComparer);
        b.Property(x => x.InvolvedCharacters)
            .HasConversion(JsonValueConverters.StringList)
            .Metadata.SetValueComparer(JsonValueConverters.StringListComparer);
    }
}

public class ConflictProgressPointConfiguration : IEntityTypeConfiguration<ConflictProgressPoint>
{
    public void Configure(EntityTypeBuilder<ConflictProgressPoint> b)
    {
        b.ToTable("conflict_progress_points");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ConflictProgressEntryId).IsRequired().HasMaxLength(64);
        b.Property(x => x.ChapterId).IsRequired().HasMaxLength(64);
        b.HasIndex(x => new { x.ConflictProgressEntryId, x.ChapterId });
        b.HasOne(x => x.ConflictProgressEntry)
            .WithMany(e => e.ProgressPoints)
            .HasForeignKey(x => x.ConflictProgressEntryId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ChapterTimelineConfiguration : IEntityTypeConfiguration<ChapterTimeline>
{
    public void Configure(EntityTypeBuilder<ChapterTimeline> b)
    {
        b.ToTable("chapter_timelines");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.ChapterId).IsRequired().HasMaxLength(64);
        b.HasIndex(x => new { x.ProjectId, x.ChapterId }).IsUnique();
    }
}

public class CharacterLocationConfiguration : IEntityTypeConfiguration<CharacterLocation>
{
    public void Configure(EntityTypeBuilder<CharacterLocation> b)
    {
        b.ToTable("character_locations");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.CharacterName).IsRequired().HasMaxLength(256);
        b.HasIndex(x => new { x.ProjectId, x.CharacterName }).IsUnique();
    }
}

public class CharacterMovementConfiguration : IEntityTypeConfiguration<CharacterMovement>
{
    public void Configure(EntityTypeBuilder<CharacterMovement> b)
    {
        b.ToTable("character_movements");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.CharacterName).IsRequired().HasMaxLength(256);
        b.Property(x => x.ChapterId).IsRequired().HasMaxLength(64);
        b.HasIndex(x => new { x.ProjectId, x.CharacterName, x.ChapterId });
    }
}

public class ForeshadowingConfiguration : IEntityTypeConfiguration<Foreshadowing>
{
    public void Configure(EntityTypeBuilder<Foreshadowing> b)
    {
        b.ToTable("foreshadowings");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.Name).IsRequired().HasMaxLength(256);
        b.Property(x => x.Tier).HasMaxLength(16);
        b.HasIndex(x => new { x.ProjectId, x.Tier });
        b.HasIndex(x => new { x.ProjectId, x.IsResolved, x.IsOverdue });
    }
}

public class PlotPointConfiguration : IEntityTypeConfiguration<PlotPoint>
{
    public void Configure(EntityTypeBuilder<PlotPoint> b)
    {
        b.ToTable("plot_points");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.ChapterId).IsRequired().HasMaxLength(64);
        b.Property(x => x.Storyline).HasMaxLength(32);
        b.HasIndex(x => new { x.ProjectId, x.ChapterId });

        b.Property(x => x.Keywords)
            .HasConversion(JsonValueConverters.StringList)
            .Metadata.SetValueComparer(JsonValueConverters.StringListComparer);
        b.Property(x => x.InvolvedCharacters)
            .HasConversion(JsonValueConverters.StringList)
            .Metadata.SetValueComparer(JsonValueConverters.StringListComparer);
    }
}

public class VolumeFactArchiveConfiguration : IEntityTypeConfiguration<VolumeFactArchive>
{
    public void Configure(EntityTypeBuilder<VolumeFactArchive> b)
    {
        b.ToTable("volume_fact_archives");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.VolumeId).IsRequired().HasMaxLength(64);
        b.HasIndex(x => new { x.ProjectId, x.VolumeNumber }).IsUnique();
    }
}
