using FluentAssertions;
using Microsoft.Data.Sqlite;
using TM.Web.Infrastructure.Persistence;
using Xunit;

namespace TM.Web.Tests;

public class ChapterBatchGenerationSchemaCompatibilityTests
{
    [Fact]
    public async Task EnsureTablesAsync_creates_missing_batch_job_tables()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDbContext(TestDb.CreateOptions(connection));

        await ChapterBatchGenerationSchemaCompatibility.EnsureTablesAsync(db);

        (await TableExistsAsync(connection, "chapter_batch_generation_jobs")).Should().BeTrue();
        (await TableExistsAsync(connection, "chapter_batch_generation_job_logs")).Should().BeTrue();
    }

    private static async Task<bool> TableExistsAsync(SqliteConnection connection, string tableName)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = $name LIMIT 1";
        command.Parameters.AddWithValue("$name", tableName);
        return await command.ExecuteScalarAsync() is not null;
    }
}
