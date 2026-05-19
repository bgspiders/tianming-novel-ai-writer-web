using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace TM.Web.Infrastructure.Persistence;

/// <summary>
/// DI 注册扩展。在 Program.cs 调用 services.AddAppDatabase(builder.Configuration)。
/// </summary>
public static class DbServiceCollectionExtensions
{
    public static IServiceCollection AddAppDatabase(this IServiceCollection services, IConfiguration configuration)
    {
        var rootPath = ResolveStorageRoot(configuration);
        Directory.CreateDirectory(rootPath);

        var dbPath = Path.Combine(rootPath, "tm.db");
        var connectionString = $"Data Source={dbPath};Cache=Shared;Foreign Keys=True";

        services.AddDbContext<AppDbContext>(opt =>
        {
            opt.UseSqlite(connectionString, sqlite =>
            {
                sqlite.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
            });
        });

        return services;
    }

    /// <summary>
    /// 从配置读 Storage:RootPath。支持相对路径（相对 ContentRoot）和环境变量替换 ~/。
    /// 未配置时回退到 ./Storage。
    /// </summary>
    public static string ResolveStorageRoot(IConfiguration configuration)
    {
        var raw = configuration["Storage:RootPath"];
        if (string.IsNullOrWhiteSpace(raw))
        {
            raw = "./Storage";
        }

        if (raw.StartsWith("~/"))
        {
            var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            raw = Path.Combine(home, raw[2..]);
        }

        return Path.IsPathRooted(raw)
            ? raw
            : Path.GetFullPath(raw, AppContext.BaseDirectory);
    }
}
