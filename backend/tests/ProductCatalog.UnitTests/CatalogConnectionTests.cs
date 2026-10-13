using Microsoft.Data.Sqlite;
using ProductCatalog.Api.Data;

namespace ProductCatalog.UnitTests;

public class CatalogConnectionTests
{
    [Fact]
    public void Unknown_migration_history_deletes_the_database_file()
    {
        var path = TempPath();
        var connectionString = ConnectionString(path);
        try
        {
            WriteHistory(connectionString, "20261002131222_InitialCreate");

            CatalogConnection.DeleteDatabaseIfHistoryIsUnknown(connectionString, ["20261005153115_InitialCreate"]);

            Assert.False(File.Exists(path));
        }
        finally
        {
            Delete(path);
        }
    }

    [Fact]
    public void Known_migration_history_keeps_the_database_file()
    {
        var path = TempPath();
        var connectionString = ConnectionString(path);
        try
        {
            WriteHistory(connectionString, "20261005153115_InitialCreate");

            CatalogConnection.DeleteDatabaseIfHistoryIsUnknown(connectionString, ["20261005153115_InitialCreate"]);

            Assert.True(File.Exists(path));
        }
        finally
        {
            Delete(path);
        }
    }

    private static string TempPath() =>
        Path.Combine(Path.GetTempPath(), $"catalog-history-{Guid.NewGuid():N}.db");

    private static string ConnectionString(string path) =>
        new SqliteConnectionStringBuilder { DataSource = path, DefaultTimeout = 30 }.ToString();

    private static void WriteHistory(string connectionString, string migrationId)
    {
        using var connection = new SqliteConnection(connectionString);
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE __EFMigrationsHistory (
                MigrationId TEXT NOT NULL PRIMARY KEY,
                ProductVersion TEXT NOT NULL
            );
            INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion)
            VALUES ($id, '10.0.12');
            """;
        command.Parameters.AddWithValue("$id", migrationId);
        command.ExecuteNonQuery();
        SqliteConnection.ClearAllPools();
    }

    private static void Delete(string path)
    {
        SqliteConnection.ClearAllPools();
        if (File.Exists(path))
            File.Delete(path);
    }
}
