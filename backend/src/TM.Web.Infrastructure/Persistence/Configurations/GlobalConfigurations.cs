using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TM.Web.Domain.Entities.Global;

namespace TM.Web.Infrastructure.Persistence.Configurations;

public class PromptTemplateConfiguration : IEntityTypeConfiguration<PromptTemplate>
{
    public void Configure(EntityTypeBuilder<PromptTemplate> b)
    {
        b.ToTable("prompt_templates");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.Code).IsRequired().HasMaxLength(128);
        b.Property(x => x.Name).IsRequired().HasMaxLength(256);
        b.Property(x => x.Category).HasMaxLength(128);
        b.HasIndex(x => x.Code).IsUnique();
        b.HasIndex(x => new { x.Category, x.SortOrder });
    }
}

public class AppSettingConfiguration : IEntityTypeConfiguration<AppSetting>
{
    public void Configure(EntityTypeBuilder<AppSetting> b)
    {
        b.ToTable("app_settings");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.Key).IsRequired().HasMaxLength(256);
        b.Property(x => x.ValueType).HasMaxLength(32);
        b.HasIndex(x => x.Key).IsUnique();
    }
}

public class ThemeConfiguration : IEntityTypeConfiguration<Theme>
{
    public void Configure(EntityTypeBuilder<Theme> b)
    {
        b.ToTable("themes");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.Code).IsRequired().HasMaxLength(128);
        b.Property(x => x.Name).IsRequired().HasMaxLength(256);
        b.HasIndex(x => x.Code).IsUnique();
    }
}

public class NotificationHistoryConfiguration : IEntityTypeConfiguration<NotificationHistory>
{
    public void Configure(EntityTypeBuilder<NotificationHistory> b)
    {
        b.ToTable("notification_history");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.Type).HasMaxLength(32);
        b.Property(x => x.Title).HasMaxLength(256);
        b.HasIndex(x => new { x.IsRead, x.CreatedAt });
    }
}

public class UploadConfiguration : IEntityTypeConfiguration<Upload>
{
    public void Configure(EntityTypeBuilder<Upload> b)
    {
        b.ToTable("uploads");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.FileName).IsRequired().HasMaxLength(256);
        b.Property(x => x.MimeType).HasMaxLength(128);
        b.Property(x => x.StoragePath).IsRequired().HasMaxLength(512);
        b.Property(x => x.Sha256).HasMaxLength(64);
        b.Property(x => x.Purpose).HasMaxLength(64);
        b.HasIndex(x => x.Sha256);
    }
}

public class AppUserConfiguration : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> b)
    {
        b.ToTable("app_users");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.Username).IsRequired().HasMaxLength(64);
        b.Property(x => x.PasswordHash).IsRequired().HasMaxLength(128);
        b.Property(x => x.PasswordSalt).IsRequired().HasMaxLength(64);
        b.HasIndex(x => x.Username).IsUnique();
    }
}

public class AppSessionConfiguration : IEntityTypeConfiguration<AppSession>
{
    public void Configure(EntityTypeBuilder<AppSession> b)
    {
        b.ToTable("app_sessions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasMaxLength(64);
        b.Property(x => x.UserId).IsRequired().HasMaxLength(64);
        b.Property(x => x.TokenHash).IsRequired().HasMaxLength(64);
        b.HasIndex(x => x.TokenHash).IsUnique();
        b.HasIndex(x => new { x.UserId, x.ExpiresAt });
        b.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
