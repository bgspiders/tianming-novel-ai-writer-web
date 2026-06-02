using Microsoft.EntityFrameworkCore;
using TM.Web.Domain.Common;
using TM.Web.Domain.Entities.AI;
using TM.Web.Domain.Entities.Core;
using TM.Web.Domain.Entities.Design;
using TM.Web.Domain.Entities.Generate;
using TM.Web.Domain.Entities.Global;
using TM.Web.Domain.Entities.Indexing;
using TM.Web.Domain.Entities.Metadata;
using TM.Web.Domain.Entities.Runtime;
using TM.Web.Domain.Entities.Tracking;
using TM.Web.Domain.Entities.Validation;

namespace TM.Web.Infrastructure.Persistence;

/// <summary>
/// 应用主数据库上下文。所有持久化实体都在此注册 DbSet。
/// 表名/索引/外键/JSON 列在 OnModelCreating 中集中配置，按数据模型映射.md 第二节落地。
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // Core
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Volume> Volumes => Set<Volume>();
    public DbSet<Chapter> Chapters => Set<Chapter>();
    public DbSet<SourceBook> SourceBooks => Set<SourceBook>();
    public DbSet<Category> Categories => Set<Category>();

    // Design
    public DbSet<WorldRule> WorldRules => Set<WorldRule>();
    public DbSet<CharacterRule> CharacterRules => Set<CharacterRule>();
    public DbSet<FactionRule> FactionRules => Set<FactionRule>();
    public DbSet<LocationRule> LocationRules => Set<LocationRule>();
    public DbSet<PlotRule> PlotRules => Set<PlotRule>();
    public DbSet<CreativeMaterial> CreativeMaterials => Set<CreativeMaterial>();
    public DbSet<BookAnalysis> BookAnalyses => Set<BookAnalysis>();

    // Generate
    public DbSet<Outline> Outlines => Set<Outline>();
    public DbSet<VolumeDesign> VolumeDesigns => Set<VolumeDesign>();
    public DbSet<ChapterPlan> ChapterPlans => Set<ChapterPlan>();
    public DbSet<ChapterBlueprint> ChapterBlueprints => Set<ChapterBlueprint>();

    // Tracking
    public DbSet<CharacterStateEntry> CharacterStateEntries => Set<CharacterStateEntry>();
    public DbSet<CharacterStatePoint> CharacterStatePoints => Set<CharacterStatePoint>();
    public DbSet<CharacterRelationshipState> CharacterRelationshipStates => Set<CharacterRelationshipState>();
    public DbSet<FactionStateEntry> FactionStateEntries => Set<FactionStateEntry>();
    public DbSet<FactionStatePoint> FactionStatePoints => Set<FactionStatePoint>();
    public DbSet<LocationStateEntry> LocationStateEntries => Set<LocationStateEntry>();
    public DbSet<LocationStatePoint> LocationStatePoints => Set<LocationStatePoint>();
    public DbSet<ItemStateEntry> ItemStateEntries => Set<ItemStateEntry>();
    public DbSet<ItemStatePoint> ItemStatePoints => Set<ItemStatePoint>();
    public DbSet<ConflictProgressEntry> ConflictProgressEntries => Set<ConflictProgressEntry>();
    public DbSet<ConflictProgressPoint> ConflictProgressPoints => Set<ConflictProgressPoint>();
    public DbSet<ChapterTimeline> ChapterTimelines => Set<ChapterTimeline>();
    public DbSet<CharacterLocation> CharacterLocations => Set<CharacterLocation>();
    public DbSet<CharacterMovement> CharacterMovements => Set<CharacterMovement>();
    public DbSet<Foreshadowing> Foreshadowings => Set<Foreshadowing>();
    public DbSet<PlotPoint> PlotPoints => Set<PlotPoint>();
    public DbSet<VolumeFactArchive> VolumeFactArchives => Set<VolumeFactArchive>();

    // Validation
    public DbSet<ValidationReport> ValidationReports => Set<ValidationReport>();
    public DbSet<ValidationItem> ValidationItems => Set<ValidationItem>();
    public DbSet<ValidationSummary> ValidationSummaries => Set<ValidationSummary>();

    // AI
    public DbSet<AiProvider> AiProviders => Set<AiProvider>();
    public DbSet<AiModel> AiModels => Set<AiModel>();
    public DbSet<AiApiKey> AiApiKeys => Set<AiApiKey>();

    // Runtime
    public DbSet<GenerationRecord> GenerationRecords => Set<GenerationRecord>();
    public DbSet<GenerationStatistics> GenerationStatistics => Set<GenerationStatistics>();
    public DbSet<ChatSession> ChatSessions => Set<ChatSession>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();

    // Indexing
    public DbSet<KeywordChapterIndex> KeywordChapterIndices => Set<KeywordChapterIndex>();
    public DbSet<RelationStrengthIndex> RelationStrengthIndices => Set<RelationStrengthIndex>();
    public DbSet<GlobalSummaryCache> GlobalSummaryCaches => Set<GlobalSummaryCache>();
    public DbSet<LayerCompletionStatus> LayerCompletionStatuses => Set<LayerCompletionStatus>();

    // Metadata
    public DbSet<Manifest> Manifests => Set<Manifest>();
    public DbSet<WorkScope> WorkScopes => Set<WorkScope>();

    // Global
    public DbSet<PromptTemplate> PromptTemplates => Set<PromptTemplate>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();
    public DbSet<Theme> Themes => Set<Theme>();
    public DbSet<NotificationHistory> NotificationHistory => Set<NotificationHistory>();
    public DbSet<Upload> Uploads => Set<Upload>();
    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<AppSession> AppSessions => Set<AppSession>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    public override int SaveChanges()
    {
        TouchTimestamps();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TouchTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void TouchTimestamps()
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<EntityBase>())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity.CreatedAt == default) entry.Entity.CreatedAt = now;
                entry.Entity.UpdatedAt = now;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
            }
        }
    }
}
