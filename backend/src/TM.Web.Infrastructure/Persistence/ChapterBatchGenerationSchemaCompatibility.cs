using Microsoft.EntityFrameworkCore;

namespace TM.Web.Infrastructure.Persistence;

public static class ChapterBatchGenerationSchemaCompatibility
{
    public static async Task EnsureTablesAsync(AppDbContext db, CancellationToken ct = default)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS chapter_batch_generation_jobs (
                Id TEXT NOT NULL CONSTRAINT PK_chapter_batch_generation_jobs PRIMARY KEY,
                JobId TEXT NOT NULL,
                ProjectId TEXT NOT NULL,
                VolumeId TEXT NOT NULL,
                Status TEXT NOT NULL,
                StartChapterNumber INTEGER NOT NULL,
                Total INTEGER NOT NULL,
                Completed INTEGER NOT NULL,
                Failed INTEGER NOT NULL,
                Skipped INTEGER NOT NULL,
                CurrentChapterNumber INTEGER NOT NULL,
                CurrentChapterTitle TEXT NOT NULL,
                Message TEXT NOT NULL,
                RequestJson TEXT NOT NULL,
                CancelRequested INTEGER NOT NULL,
                QueuedAt TEXT NOT NULL,
                StartedAt TEXT NULL,
                FinishedAt TEXT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL
            );
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS chapter_batch_generation_job_logs (
                Id TEXT NOT NULL CONSTRAINT PK_chapter_batch_generation_job_logs PRIMARY KEY,
                JobId TEXT NOT NULL,
                ProjectId TEXT NOT NULL,
                Level TEXT NOT NULL,
                Message TEXT NOT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL
            );
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE UNIQUE INDEX IF NOT EXISTS IX_chapter_batch_generation_jobs_JobId
            ON chapter_batch_generation_jobs (JobId);
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE INDEX IF NOT EXISTS IX_chapter_batch_generation_jobs_ProjectId_QueuedAt
            ON chapter_batch_generation_jobs (ProjectId, QueuedAt);
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE INDEX IF NOT EXISTS IX_chapter_batch_generation_job_logs_JobId_CreatedAt
            ON chapter_batch_generation_job_logs (JobId, CreatedAt);
            """, ct);
    }
}
