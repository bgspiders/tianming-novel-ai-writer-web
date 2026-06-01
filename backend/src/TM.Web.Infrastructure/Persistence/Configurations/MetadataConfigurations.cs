using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TM.Web.Domain.Entities.Metadata;

namespace TM.Web.Infrastructure.Persistence.Configurations;

public class ManifestConfiguration : IEntityTypeConfiguration<Manifest>
{
    public void Configure(EntityTypeBuilder<Manifest> b)
    {
        b.ToTable("manifests");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.SourceBookId).HasMaxLength(64);
        b.HasIndex(x => new { x.ProjectId, x.Version }).IsUnique();
    }
}

public class WorkScopeConfiguration : IEntityTypeConfiguration<WorkScope>
{
    public void Configure(EntityTypeBuilder<WorkScope> b)
    {
        b.ToTable("work_scope");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.CurrentSourceBookId).HasMaxLength(64);
        b.HasIndex(x => x.ProjectId).IsUnique();
    }
}
