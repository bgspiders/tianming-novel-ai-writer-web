using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TM.Web.Domain.Entities.Runtime;

namespace TM.Web.Infrastructure.Persistence.Configurations;

public class GenerationRecordConfiguration : IEntityTypeConfiguration<GenerationRecord>
{
    public void Configure(EntityTypeBuilder<GenerationRecord> b)
    {
        b.ToTable("generation_records");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.ChapterId).IsRequired().HasMaxLength(64);
        b.HasIndex(x => new { x.ProjectId, x.ChapterId, x.StartedAt });
    }
}

public class GenerationStatisticsConfiguration : IEntityTypeConfiguration<GenerationStatistics>
{
    public void Configure(EntityTypeBuilder<GenerationStatistics> b)
    {
        b.ToTable("generation_statistics");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.HasIndex(x => x.ProjectId).IsUnique();
    }
}

public class ChatSessionConfiguration : IEntityTypeConfiguration<ChatSession>
{
    public void Configure(EntityTypeBuilder<ChatSession> b)
    {
        b.ToTable("chat_sessions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).HasMaxLength(64);
        b.Property(x => x.Title).HasMaxLength(256);
        b.Property(x => x.Mode).HasMaxLength(32);
        b.Property(x => x.ModelCode).HasMaxLength(128);
        b.Property(x => x.ProviderId).HasMaxLength(64);
        b.HasIndex(x => new { x.ProjectId, x.LastMessageAt });
    }
}

public class ChatMessageConfiguration : IEntityTypeConfiguration<ChatMessage>
{
    public void Configure(EntityTypeBuilder<ChatMessage> b)
    {
        b.ToTable("chat_messages");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ChatSessionId).IsRequired().HasMaxLength(64);
        b.Property(x => x.Role).IsRequired().HasMaxLength(32);
        b.HasIndex(x => new { x.ChatSessionId, x.CreatedAt });
        b.HasOne(x => x.ChatSession)
            .WithMany(s => s.Messages)
            .HasForeignKey(x => x.ChatSessionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
