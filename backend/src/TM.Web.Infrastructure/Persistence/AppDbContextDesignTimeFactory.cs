using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace TM.Web.Infrastructure.Persistence;

/// <summary>
/// 设计时工厂。dotnet ef migrations / dotnet ef database update 不需要启动整个 Web Host，
/// 仅在工具运行时构造一个独立的 AppDbContext 即可。
/// 默认数据库写到 ./Storage/tm.db 相对当前工作目录。
/// </summary>
public class AppDbContextDesignTimeFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var rootPath = Environment.GetEnvironmentVariable("TM_STORAGE_ROOT")
                       ?? Path.Combine(Directory.GetCurrentDirectory(), "Storage");
        Directory.CreateDirectory(rootPath);
        var dbPath = Path.Combine(rootPath, "tm.db");

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseSqlite($"Data Source={dbPath};Cache=Shared;Foreign Keys=True");
        return new AppDbContext(optionsBuilder.Options);
    }
}
