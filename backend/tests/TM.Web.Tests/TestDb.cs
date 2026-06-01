using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TM.Web.Infrastructure.Persistence;

namespace TM.Web.Tests;

internal static class TestDb
{
    public static async Task<(AppDbContext Db, SqliteConnection Connection)> CreateAsync()
    {
        var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connection)
            .Options;

        var db = new AppDbContext(options);
        await db.Database.EnsureCreatedAsync();
        return (db, connection);
    }
}
