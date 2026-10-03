using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ProductCatalog.Api.Data;
using ProductCatalog.Api.Domain;

namespace ProductCatalog.BddTests.Support;

public sealed class CatalogApp : WebApplicationFactory<Program>
{
    public static CatalogApp Current { get; private set; } = null!;

    private readonly string _databasePath;
    private HttpClient? _client;

    public CatalogApp()
    {
        _databasePath = Path.Combine(Path.GetTempPath(), $"catalog-bdd-{Guid.NewGuid():N}.db");
        Current = this;
    }

    public HttpClient Client => _client ??= CreateClient();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        var connectionString = $"Data Source={_databasePath};Default Timeout=30";

        builder.UseSetting("ConnectionStrings:Catalog", connectionString);
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Catalog"] = connectionString
            });
        });
    }

    public async Task ResetAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();
        var connectionString = db.Database.GetDbConnection().ConnectionString;
        if (!connectionString.Contains(_databasePath, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                "The test host is pointed at the wrong database: " + connectionString);
        }

        await db.Database.MigrateAsync();
        await db.Products.ExecuteDeleteAsync();
        db.Products.AddRange(SeedData.Products());

        var sequence = await db.IdSequences.SingleAsync(s => s.Name == IdSequence.ProductName);
        sequence.LastValue = SeedData.LastSeededProductId;
        await db.SaveChangesAsync();
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (!disposing)
            return;

        SqliteConnection.ClearAllPools();
        TryDelete(_databasePath);
        TryDelete(_databasePath + "-wal");
        TryDelete(_databasePath + "-shm");
    }

    private static void TryDelete(string path)
    {
        try
        {
            if (File.Exists(path))
                File.Delete(path);
        }
        catch (IOException)
        {
        }
    }
}
