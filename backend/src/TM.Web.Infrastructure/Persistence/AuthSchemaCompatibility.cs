using Microsoft.EntityFrameworkCore;

namespace TM.Web.Infrastructure.Persistence;

public static class AuthSchemaCompatibility
{
    public static async Task EnsureAuthTablesAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (await TableExistsAsync(db, "app_users", ct) && await TableExistsAsync(db, "app_sessions", ct))
        {
            return;
        }

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS app_users (
                Id TEXT NOT NULL CONSTRAINT PK_app_users PRIMARY KEY,
                Username TEXT NOT NULL,
                PasswordHash TEXT NOT NULL,
                PasswordSalt TEXT NOT NULL,
                LastLoginAt TEXT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL
            );
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE UNIQUE INDEX IF NOT EXISTS IX_app_users_Username
            ON app_users (Username);
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS app_sessions (
                Id TEXT NOT NULL CONSTRAINT PK_app_sessions PRIMARY KEY,
                UserId TEXT NOT NULL,
                TokenHash TEXT NOT NULL,
                ExpiresAt TEXT NOT NULL,
                RevokedAt TEXT NULL,
                LastSeenAt TEXT NOT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL,
                CONSTRAINT FK_app_sessions_app_users_UserId
                    FOREIGN KEY (UserId) REFERENCES app_users (Id) ON DELETE CASCADE
            );
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE UNIQUE INDEX IF NOT EXISTS IX_app_sessions_TokenHash
            ON app_sessions (TokenHash);
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE INDEX IF NOT EXISTS IX_app_sessions_UserId_ExpiresAt
            ON app_sessions (UserId, ExpiresAt);
            """, ct);
    }

    private static async Task<bool> TableExistsAsync(AppDbContext db, string tableName, CancellationToken ct)
    {
        var connection = db.Database.GetDbConnection();
        var shouldClose = connection.State == System.Data.ConnectionState.Closed;
        if (shouldClose)
        {
            await connection.OpenAsync(ct);
        }

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
            if (shouldClose)
            {
                await connection.CloseAsync();
            }
        }
    }
}

