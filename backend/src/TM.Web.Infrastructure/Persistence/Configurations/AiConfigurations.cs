using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TM.Web.Domain.Entities.AI;

namespace TM.Web.Infrastructure.Persistence.Configurations;

public class AiProviderConfiguration : IEntityTypeConfiguration<AiProvider>
{
    public void Configure(EntityTypeBuilder<AiProvider> b)
    {
        b.ToTable("ai_providers");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.Code).IsRequired().HasMaxLength(64);
        b.Property(x => x.Name).IsRequired().HasMaxLength(128);
        b.Property(x => x.DefaultEndpoint).HasMaxLength(512);
        b.Property(x => x.IconUrl).HasMaxLength(512);
        b.HasIndex(x => x.Code).IsUnique();
    }
}

public class AiModelConfiguration : IEntityTypeConfiguration<AiModel>
{
    public void Configure(EntityTypeBuilder<AiModel> b)
    {
        b.ToTable("ai_models");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProviderId).IsRequired().HasMaxLength(64);
        b.Property(x => x.Code).IsRequired().HasMaxLength(128);
        b.Property(x => x.Name).IsRequired().HasMaxLength(256);
        b.Property(x => x.InputPricePerMillion).HasPrecision(18, 6);
        b.Property(x => x.OutputPricePerMillion).HasPrecision(18, 6);
        b.HasIndex(x => new { x.ProviderId, x.Code }).IsUnique();
        b.HasOne(x => x.Provider)
            .WithMany(p => p.Models)
            .HasForeignKey(x => x.ProviderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class AiApiKeyConfiguration : IEntityTypeConfiguration<AiApiKey>
{
    public void Configure(EntityTypeBuilder<AiApiKey> b)
    {
        b.ToTable("ai_api_keys");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProviderId).IsRequired().HasMaxLength(64);
        b.Property(x => x.Name).IsRequired().HasMaxLength(128);
        b.Property(x => x.MaskedTail).HasMaxLength(16);
        b.HasIndex(x => new { x.ProviderId, x.RotationOrder });
        b.HasOne(x => x.Provider)
            .WithMany(p => p.ApiKeys)
            .HasForeignKey(x => x.ProviderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
