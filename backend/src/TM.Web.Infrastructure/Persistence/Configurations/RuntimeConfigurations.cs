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

public class GenerationPreflightReportConfiguration : IEntityTypeConfiguration<GenerationPreflightReport>
{
    public void Configure(EntityTypeBuilder<GenerationPreflightReport> b)
    {
        b.ToTable("generation_preflight_reports");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.VolumeId).HasMaxLength(64);
        b.Property(x => x.ChapterId).HasMaxLength(64);
        b.HasIndex(x => new { x.ProjectId, x.ChapterId, x.CreatedAt });
    }
}

public class SceneGenerationRecordConfiguration : IEntityTypeConfiguration<SceneGenerationRecord>
{
    public void Configure(EntityTypeBuilder<SceneGenerationRecord> b)
    {
        b.ToTable("scene_generation_records");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.RunId).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.ChapterId).IsRequired().HasMaxLength(64);
        b.Property(x => x.SceneTitle).HasMaxLength(256);
        b.Property(x => x.Model).HasMaxLength(128);
        b.HasIndex(x => new { x.ProjectId, x.ChapterId, x.SceneNumber, x.CreatedAt });
    }
}

public class ChapterAnalysisReportConfiguration : IEntityTypeConfiguration<ChapterAnalysisReport>
{
    public void Configure(EntityTypeBuilder<ChapterAnalysisReport> b)
    {
        b.ToTable("chapter_analysis_reports");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.ChapterId).IsRequired().HasMaxLength(64);
        b.HasIndex(x => new { x.ProjectId, x.ChapterId, x.CreatedAt });
    }
}

public class ChapterBatchGenerationJobRecordConfiguration : IEntityTypeConfiguration<ChapterBatchGenerationJobRecord>
{
    public void Configure(EntityTypeBuilder<ChapterBatchGenerationJobRecord> b)
    {
        b.ToTable("chapter_batch_generation_jobs");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.JobId).IsRequired().HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.VolumeId).IsRequired().HasMaxLength(64);
        b.Property(x => x.Status).IsRequired().HasMaxLength(32);
        b.Property(x => x.CurrentChapterTitle).HasMaxLength(256);
        b.HasIndex(x => x.JobId).IsUnique();
        b.HasIndex(x => new { x.ProjectId, x.QueuedAt });
    }
}

public class ChapterBatchGenerationJobLogConfiguration : IEntityTypeConfiguration<ChapterBatchGenerationJobLog>
{
    public void Configure(EntityTypeBuilder<ChapterBatchGenerationJobLog> b)
    {
        b.ToTable("chapter_batch_generation_job_logs");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.JobId).IsRequired().HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.Level).IsRequired().HasMaxLength(16);
        b.HasIndex(x => new { x.JobId, x.CreatedAt });
    }
}

public class NovelSeedWorkflowConfiguration : IEntityTypeConfiguration<NovelSeedWorkflow>
{
    public void Configure(EntityTypeBuilder<NovelSeedWorkflow> b)
    {
        b.ToTable("novel_seed_workflows");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.Status).IsRequired().HasMaxLength(32);
        b.Property(x => x.ProjectId).HasMaxLength(64);
        b.HasIndex(x => new { x.Status, x.CreatedAt });
    }
}

public class NovelSeedWorkflowStepConfiguration : IEntityTypeConfiguration<NovelSeedWorkflowStep>
{
    public void Configure(EntityTypeBuilder<NovelSeedWorkflowStep> b)
    {
        b.ToTable("novel_seed_workflow_steps");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.WorkflowId).IsRequired().HasMaxLength(64);
        b.Property(x => x.StepKey).IsRequired().HasMaxLength(32);
        b.Property(x => x.Title).IsRequired().HasMaxLength(128);
        b.Property(x => x.Status).IsRequired().HasMaxLength(32);
        b.HasIndex(x => new { x.WorkflowId, x.StepKey }).IsUnique();
        b.HasIndex(x => new { x.WorkflowId, x.SortOrder });
    }
}

public class PromptRunSnapshotConfiguration : IEntityTypeConfiguration<PromptRunSnapshot>
{
    public void Configure(EntityTypeBuilder<PromptRunSnapshot> b)
    {
        b.ToTable("prompt_run_snapshots");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.RunId).IsRequired().HasMaxLength(64);
        b.Property(x => x.ProjectId).IsRequired().HasMaxLength(64);
        b.Property(x => x.ChapterId).HasMaxLength(64);
        b.Property(x => x.WorkflowId).HasMaxLength(64);
        b.Property(x => x.StepKey).HasMaxLength(32);
        b.Property(x => x.Source).IsRequired().HasMaxLength(64);
        b.Property(x => x.Model).HasMaxLength(128);
        b.Property(x => x.ContextHash).HasMaxLength(64);
        b.HasIndex(x => new { x.ProjectId, x.ChapterId, x.CreatedAt });
        b.HasIndex(x => x.RunId);
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
        b.Property(x => x.Summary).HasMaxLength(512);
        b.HasIndex(x => new { x.ChatSessionId, x.CreatedAt });
        b.HasOne(x => x.ChatSession)
            .WithMany(s => s.Messages)
            .HasForeignKey(x => x.ChatSessionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
