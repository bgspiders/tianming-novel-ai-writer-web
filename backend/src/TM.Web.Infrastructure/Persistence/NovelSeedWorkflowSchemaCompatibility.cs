using Microsoft.EntityFrameworkCore;

namespace TM.Web.Infrastructure.Persistence;

public static class NovelSeedWorkflowSchemaCompatibility
{
    public static async Task EnsureTablesAsync(AppDbContext db, CancellationToken ct = default)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS novel_seed_workflows (
                Id TEXT NOT NULL CONSTRAINT PK_novel_seed_workflows PRIMARY KEY,
                Status TEXT NOT NULL,
                RequestJson TEXT NOT NULL,
                ProjectId TEXT NULL,
                Error TEXT NOT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL
            );
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS novel_seed_workflow_steps (
                Id TEXT NOT NULL CONSTRAINT PK_novel_seed_workflow_steps PRIMARY KEY,
                WorkflowId TEXT NOT NULL,
                StepKey TEXT NOT NULL,
                Title TEXT NOT NULL,
                SortOrder INTEGER NOT NULL,
                Status TEXT NOT NULL,
                IsConfirmed INTEGER NOT NULL DEFAULT 0,
                Prompt TEXT NOT NULL,
                Output TEXT NOT NULL,
                Error TEXT NOT NULL,
                StartedAt TEXT NULL,
                FinishedAt TEXT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL
            );
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS prompt_run_snapshots (
                Id TEXT NOT NULL CONSTRAINT PK_prompt_run_snapshots PRIMARY KEY,
                RunId TEXT NOT NULL,
                ProjectId TEXT NOT NULL,
                ChapterId TEXT NULL,
                WorkflowId TEXT NULL,
                StepKey TEXT NULL,
                Source TEXT NOT NULL,
                Model TEXT NOT NULL,
                Temperature REAL NULL,
                MaxTokens INTEGER NULL,
                ContextHash TEXT NOT NULL,
                ContextSummary TEXT NOT NULL,
                PromptSummary TEXT NOT NULL,
                OutputSummary TEXT NOT NULL,
                Success INTEGER NOT NULL,
                Error TEXT NOT NULL,
                ElapsedMs INTEGER NOT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL
            );
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS generation_preflight_reports (
                Id TEXT NOT NULL CONSTRAINT PK_generation_preflight_reports PRIMARY KEY,
                ProjectId TEXT NOT NULL,
                VolumeId TEXT NULL,
                ChapterId TEXT NULL,
                Passed INTEGER NOT NULL,
                FatalCount INTEGER NOT NULL,
                WarningCount INTEGER NOT NULL,
                ItemsJson TEXT NOT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL
            );
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS scene_generation_records (
                Id TEXT NOT NULL CONSTRAINT PK_scene_generation_records PRIMARY KEY,
                RunId TEXT NOT NULL,
                ProjectId TEXT NOT NULL,
                ChapterId TEXT NOT NULL,
                SceneNumber INTEGER NOT NULL,
                SceneTitle TEXT NOT NULL,
                Model TEXT NOT NULL,
                PromptSnapshot TEXT NOT NULL,
                Content TEXT NOT NULL,
                Success INTEGER NOT NULL,
                Error TEXT NOT NULL,
                CharCount INTEGER NOT NULL,
                ElapsedMs INTEGER NOT NULL,
                FinishReason TEXT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL
            );
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS chapter_analysis_reports (
                Id TEXT NOT NULL CONSTRAINT PK_chapter_analysis_reports PRIMARY KEY,
                ProjectId TEXT NOT NULL,
                ChapterId TEXT NOT NULL,
                Passed INTEGER NOT NULL,
                ShouldPauseBatch INTEGER NOT NULL,
                WordCount INTEGER NOT NULL,
                CoherenceScore INTEGER NOT NULL,
                QualityScore INTEGER NOT NULL,
                Summary TEXT NOT NULL,
                ItemsJson TEXT NOT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL
            );
            """, ct);

        if (await TableExistsAsync(db, "novel_seed_workflow_steps", ct))
        {
            var columns = await ListColumnsAsync(db, "novel_seed_workflow_steps", ct);
            if (!columns.Contains("IsConfirmed"))
            {
                await db.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE novel_seed_workflow_steps ADD COLUMN IsConfirmed INTEGER NOT NULL DEFAULT 0;",
                    ct);
            }
        }

        await db.Database.ExecuteSqlRawAsync("""
            CREATE INDEX IF NOT EXISTS IX_novel_seed_workflows_Status_CreatedAt
            ON novel_seed_workflows (Status, CreatedAt);
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE UNIQUE INDEX IF NOT EXISTS IX_novel_seed_workflow_steps_WorkflowId_StepKey
            ON novel_seed_workflow_steps (WorkflowId, StepKey);
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE INDEX IF NOT EXISTS IX_novel_seed_workflow_steps_WorkflowId_SortOrder
            ON novel_seed_workflow_steps (WorkflowId, SortOrder);
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE INDEX IF NOT EXISTS IX_prompt_run_snapshots_ProjectId_ChapterId_CreatedAt
            ON prompt_run_snapshots (ProjectId, ChapterId, CreatedAt);
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE INDEX IF NOT EXISTS IX_prompt_run_snapshots_RunId
            ON prompt_run_snapshots (RunId);
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE INDEX IF NOT EXISTS IX_generation_preflight_reports_ProjectId_ChapterId_CreatedAt
            ON generation_preflight_reports (ProjectId, ChapterId, CreatedAt);
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE INDEX IF NOT EXISTS IX_scene_generation_records_ProjectId_ChapterId_SceneNumber_CreatedAt
            ON scene_generation_records (ProjectId, ChapterId, SceneNumber, CreatedAt);
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE INDEX IF NOT EXISTS IX_chapter_analysis_reports_ProjectId_ChapterId_CreatedAt
            ON chapter_analysis_reports (ProjectId, ChapterId, CreatedAt);
            """, ct);
    }

    private static async Task<bool> TableExistsAsync(AppDbContext db, string tableName, CancellationToken ct)
    {
        var connection = db.Database.GetDbConnection();
        var shouldClose = connection.State == System.Data.ConnectionState.Closed;
        if (shouldClose) await connection.OpenAsync(ct);

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = $name LIMIT 1";
            var parameter = command.CreateParameter();
            parameter.ParameterName = "$name";
            parameter.Value = tableName;
            command.Parameters.Add(parameter);
            return await command.ExecuteScalarAsync(ct) is not null;
        }
        finally
        {
            if (shouldClose) await connection.CloseAsync();
        }
    }

    private static async Task<HashSet<string>> ListColumnsAsync(AppDbContext db, string tableName, CancellationToken ct)
    {
        var connection = db.Database.GetDbConnection();
        var shouldClose = connection.State == System.Data.ConnectionState.Closed;
        if (shouldClose) await connection.OpenAsync(ct);

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = $"PRAGMA table_info({tableName});";
            var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            await using var reader = await command.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                columns.Add(reader.GetString(1));
            }

            return columns;
        }
        finally
        {
            if (shouldClose) await connection.CloseAsync();
        }
    }
}
