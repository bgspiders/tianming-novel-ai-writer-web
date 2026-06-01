using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TM.Web.Domain.Entities.Validation;

namespace TM.Web.Infrastructure.Persistence.Configurations;

public class ValidationReportConfiguration : IEntityTypeConfiguration<ValidationReport>
{
    public void Configure(EntityTypeBuilder<ValidationReport> b)
    {
        b.ToTable("validation_reports");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.ChapterId).IsRequired().HasMaxLength(64);
        b.Property(x => x.RunId).IsRequired().HasMaxLength(64);
        b.Property(x => x.Result).HasMaxLength(32);
        b.HasIndex(x => new { x.ProjectId, x.RunId });
        b.HasIndex(x => new { x.ProjectId, x.ChapterId, x.ValidatedAt });
    }
}

public class ValidationItemConfiguration : IEntityTypeConfiguration<ValidationItem>
{
    public void Configure(EntityTypeBuilder<ValidationItem> b)
    {
        b.ToTable("validation_items");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ValidationReportId).IsRequired().HasMaxLength(64);
        b.Property(x => x.ValidationType).HasMaxLength(64);
        b.Property(x => x.Result).HasMaxLength(32);
        b.HasIndex(x => new { x.ValidationReportId, x.ValidationType });
        b.HasOne(x => x.ValidationReport)
            .WithMany(r => r.Items)
            .HasForeignKey(x => x.ValidationReportId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ValidationSummaryConfiguration : IEntityTypeConfiguration<ValidationSummary>
{
    public void Configure(EntityTypeBuilder<ValidationSummary> b)
    {
        b.ToTable("validation_summaries");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.LastRunId).IsRequired().HasMaxLength(64);
        b.Property(x => x.OverallResult).HasMaxLength(32);
        b.HasIndex(x => new { x.ProjectId, x.TargetVolumeNumber }).IsUnique();
    }
}
