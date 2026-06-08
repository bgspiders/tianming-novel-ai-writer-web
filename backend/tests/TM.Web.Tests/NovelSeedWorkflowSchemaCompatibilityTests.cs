using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TM.Web.Infrastructure.Persistence;
using Xunit;

namespace TM.Web.Tests;

public class NovelSeedWorkflowSchemaCompatibilityTests
{
    [Fact]
    public async Task EnsureTablesAsync_creates_missing_workflow_tables()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDbContext(TestDb.CreateOptions(connection));

        await NovelSeedWorkflowSchemaCompatibility.EnsureTablesAsync(db);

        (await TableExistsAsync(connection, "novel_seed_workflows")).Should().BeTrue();
        (await TableExistsAsync(connection, "novel_seed_workflow_steps")).Should().BeTrue();
        (await TableExistsAsync(connection, "generation_preflight_reports")).Should().BeTrue();
        (await TableExistsAsync(connection, "scene_generation_records")).Should().BeTrue();
        (await TableExistsAsync(connection, "chapter_analysis_reports")).Should().BeTrue();
        (await TableExistsAsync(connection, "prompt_run_snapshots")).Should().BeTrue();
        (await ColumnExistsAsync(connection, "novel_seed_workflow_steps", "IsConfirmed")).Should().BeTrue();
    }

    [Fact]
    public async Task EnsureTablesAsync_adds_confirmation_column_to_existing_old_step_table()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDbContext(TestDb.CreateOptions(connection));

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE novel_seed_workflows (
                Id TEXT NOT NULL CONSTRAINT PK_novel_seed_workflows PRIMARY KEY,
                Status TEXT NOT NULL,
                RequestJson TEXT NOT NULL,
                ProjectId TEXT NULL,
                Error TEXT NOT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL
            );
            """);
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE novel_seed_workflow_steps (
                Id TEXT NOT NULL CONSTRAINT PK_novel_seed_workflow_steps PRIMARY KEY,
                WorkflowId TEXT NOT NULL,
                StepKey TEXT NOT NULL,
                Title TEXT NOT NULL,
                SortOrder INTEGER NOT NULL,
                Status TEXT NOT NULL,
                Prompt TEXT NOT NULL,
                Output TEXT NOT NULL,
                Error TEXT NOT NULL,
                StartedAt TEXT NULL,
                FinishedAt TEXT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL
            );
            """);

        await NovelSeedWorkflowSchemaCompatibility.EnsureTablesAsync(db);

        (await ColumnExistsAsync(connection, "novel_seed_workflow_steps", "IsConfirmed")).Should().BeTrue();
    }

    private static async Task<bool> TableExistsAsync(SqliteConnection connection, string tableName)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = $name LIMIT 1";
        command.Parameters.AddWithValue("$name", tableName);
        return await command.ExecuteScalarAsync() is not null;
    }

    private static async Task<bool> ColumnExistsAsync(SqliteConnection connection, string tableName, string columnName)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = $"PRAGMA table_info({tableName});";
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            if (string.Equals(reader.GetString(1), columnName, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }
}
