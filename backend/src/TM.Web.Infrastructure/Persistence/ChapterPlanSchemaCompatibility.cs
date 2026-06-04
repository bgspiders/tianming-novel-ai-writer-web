using Microsoft.EntityFrameworkCore;

namespace TM.Web.Infrastructure.Persistence;

public static class ChapterPlanSchemaCompatibility
{
    private static readonly (string Name, string Type, string DefaultValue)[] ProtocolColumns =
    {
        ("MacroPhase", "TEXT", "''"),
        ("TacticalArcId", "TEXT", "''"),
        ("TacticalArcTitle", "TEXT", "''"),
        ("ChapterType", "TEXT", "''"),
        ("ConflictScore", "TEXT", "''"),
        ("CoreEvent", "TEXT", "''"),
        ("AllowedEntities", "TEXT", "'[]'"),
        ("StatusMarkers", "TEXT", "''"),
        ("TemporalAnchor", "TEXT", "''"),
        ("SpatialAnchor", "TEXT", "''"),
        ("TimelineCoordinate", "TEXT", "''"),
        ("IsSingularityEvent", "INTEGER", "0"),
        ("BufferRole", "TEXT", "''"),
        ("ForeshadowingTier", "TEXT", "''"),
        ("ForeshadowingRole", "TEXT", "''")
    };

    public static async Task EnsureProtocolColumnsAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (!await TableExistsAsync(db, "chapter_plans", ct))
        {
            return;
        }

        var existing = await ListColumnsAsync(db, "chapter_plans", ct);
        foreach (var column in ProtocolColumns)
        {
            if (existing.Contains(column.Name, StringComparer.OrdinalIgnoreCase))
            {
                continue;
            }

#pragma warning disable EF1002
            await db.Database.ExecuteSqlRawAsync($"ALTER TABLE chapter_plans ADD COLUMN {column.Name} {column.Type} NOT NULL DEFAULT {column.DefaultValue};", ct);
#pragma warning restore EF1002
        }
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
