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

    private static bool IsMemory(string dataSource)
    {
        if (dataSource.Equals(":memory:", StringComparison.OrdinalIgnoreCase))
            return true;

        return dataSource.StartsWith("file:", StringComparison.OrdinalIgnoreCase)
            && dataSource.Contains("mode=memory", StringComparison.OrdinalIgnoreCase);
    }
}
