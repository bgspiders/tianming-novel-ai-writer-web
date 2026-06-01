using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TM.Web.Domain.Entities.Core;

namespace TM.Web.Infrastructure.Persistence.Configurations;

public class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> b)
    {
        b.ToTable("projects");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.Name).IsRequired().HasMaxLength(256);
        b.Property(x => x.Description).HasMaxLength(2048);
        b.Property(x => x.CurrentSourceBookId).HasMaxLength(64);
        b.HasIndex(x => x.Name).IsUnique();
    }
}

public class VolumeConfiguration : IEntityTypeConfiguration<Volume>
{
    public void Configure(EntityTypeBuilder<Volume> b)
    {
        b.ToTable("volumes");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.Title).HasMaxLength(256);
        b.Property(x => x.Theme).HasMaxLength(1024);
        b.HasIndex(x => new { x.ProjectId, x.VolumeNumber }).IsUnique();
        b.HasOne(x => x.Project)
            .WithMany(p => p.Volumes)
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ChapterConfiguration : IEntityTypeConfiguration<Chapter>
{
    public void Configure(EntityTypeBuilder<Chapter> b)
    {
        b.ToTable("chapters");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.VolumeId).IsRequired().HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.Title).HasMaxLength(512);
        b.Property(x => x.Status).HasMaxLength(32);
        b.Property(x => x.ContentFilePath).HasMaxLength(512);
        b.HasIndex(x => new { x.VolumeId, x.ChapterNumber }).IsUnique();
        b.HasIndex(x => new { x.ProjectId, x.ChapterNumber });
        b.HasOne(x => x.Volume)
            .WithMany(v => v.Chapters)
            .HasForeignKey(x => x.VolumeId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Project)
            .WithMany(p => p.Chapters)
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class SourceBookConfiguration : IEntityTypeConfiguration<SourceBook>
{
    public void Configure(EntityTypeBuilder<SourceBook> b)
    {
        b.ToTable("source_books");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.Name).IsRequired().HasMaxLength(256);
        b.Property(x => x.Author).HasMaxLength(128);
        b.Property(x => x.Genre).HasMaxLength(64);
        b.Property(x => x.Site).HasMaxLength(128);
        b.Property(x => x.Url).HasMaxLength(1024);
    }
}

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> b)
    {
        b.ToTable("categories");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ModuleType).IsRequired().HasMaxLength(64);
        b.Property(x => x.Name).IsRequired().HasMaxLength(256);
        b.Property(x => x.ParentId).HasMaxLength(64);
        b.Property(x => x.SourceBookId).HasMaxLength(64);
        b.HasIndex(x => new { x.ModuleType, x.ParentId });
        b.HasIndex(x => new { x.ModuleType, x.SourceBookId });
    }
}
