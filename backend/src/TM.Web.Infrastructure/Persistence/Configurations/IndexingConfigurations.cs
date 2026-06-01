using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TM.Web.Domain.Entities.Indexing;

namespace TM.Web.Infrastructure.Persistence.Configurations;

public class KeywordChapterIndexConfiguration : IEntityTypeConfiguration<KeywordChapterIndex>
{
    public void Configure(EntityTypeBuilder<KeywordChapterIndex> b)
    {
        b.ToTable("keyword_chapter_index");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.Keyword).IsRequired().HasMaxLength(128);
        b.Property(x => x.ChapterId).IsRequired().HasMaxLength(64);
        b.HasIndex(x => new { x.ProjectId, x.Keyword });
        b.HasIndex(x => new { x.ProjectId, x.Keyword, x.ChapterId }).IsUnique();
    }
}

public class RelationStrengthIndexConfiguration : IEntityTypeConfiguration<RelationStrengthIndex>
{
    public void Configure(EntityTypeBuilder<RelationStrengthIndex> b)
    {
        b.ToTable("relation_strength_index");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.EntityId1).IsRequired().HasMaxLength(64);
        b.Property(x => x.EntityId2).IsRequired().HasMaxLength(64);
        b.HasIndex(x => new { x.ProjectId, x.EntityId1, x.EntityId2 }).IsUnique();
    }
}

public class GlobalSummaryCacheConfiguration : IEntityTypeConfiguration<GlobalSummaryCache>
{
    public void Configure(EntityTypeBuilder<GlobalSummaryCache> b)
    {
        b.ToTable("global_summary_cache");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.HasIndex(x => x.ProjectId).IsUnique();
    }
}

public class LayerCompletionStatusConfiguration : IEntityTypeConfiguration<LayerCompletionStatus>
{
    public void Configure(EntityTypeBuilder<LayerCompletionStatus> b)
    {
        b.ToTable("layer_completion_status");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.Layer).IsRequired().HasMaxLength(32);
        b.HasIndex(x => new { x.ProjectId, x.Layer }).IsUnique();
    }
}
