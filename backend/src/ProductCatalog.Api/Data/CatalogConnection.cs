using Microsoft.Data.Sqlite;

namespace ProductCatalog.Api.Data;

public static class CatalogConnection
{
    public const string Default = "Data Source=catalog.db";

    public static string Resolve(string? connectionString, string contentRoot)
    {
        var builder = new SqliteConnectionStringBuilder(
            string.IsNullOrWhiteSpace(connectionString) ? Default : connectionString);

        if (!IsMemory(builder.DataSource) && !Path.IsPathRooted(builder.DataSource))
            builder.DataSource = Path.Combine(contentRoot, builder.DataSource);

        if (builder.DefaultTimeout < 30)
            builder.DefaultTimeout = 30;

        return builder.ToString();
    }

    public static void DeleteDatabaseIfHistoryIsUnknown(string connectionString, IEnumerable<string> knownMigrations)
    {
        var builder = new SqliteConnectionStringBuilder(connectionString);
        if (IsMemory(builder.DataSource) || !File.Exists(builder.DataSource))
            return;

        var known = knownMigrations.ToHashSet(StringComparer.Ordinal);
        var unknown = false;

        using (var connection = new SqliteConnection(connectionString))
        {
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__EFMigrationsHistory'
                """;
            if (command.ExecuteScalar() is null)
                return;

            command.CommandText = "SELECT MigrationId FROM __EFMigrationsHistory";
            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                if (!known.Contains(reader.GetString(0)))
                    unknown = true;
            }
        }

        if (!unknown)
            return;

        SqliteConnection.ClearAllPools();
        File.Delete(builder.DataSource);
        DeleteIfExists(builder.DataSource + "-wal");
        DeleteIfExists(builder.DataSource + "-shm");
    }

    private static void DeleteIfExists(string path)
    {
        if (File.Exists(path))
            File.Delete(path);
    }

    private static bool IsMemory(string dataSource)
    {
        if (dataSource.Equals(":memory:", StringComparison.OrdinalIgnoreCase))
            return true;

        return dataSource.StartsWith("file:", StringComparison.OrdinalIgnoreCase)
            && dataSource.Contains("mode=memory", StringComparison.OrdinalIgnoreCase);
    }
}
