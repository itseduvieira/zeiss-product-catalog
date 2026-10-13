using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using ProductCatalog.Api.Data;

namespace ProductCatalog.UnitTests;

internal sealed class TestDb : IAsyncDisposable
{
    private readonly string _path;

    public TestDb()
    {
        _path = Path.Combine(Path.GetTempPath(), $"catalog-tests-{Guid.NewGuid():N}.db");
        Db = new CatalogDbContext(Options());
        Db.Database.Migrate();
    }

    public CatalogDbContext Db { get; }

    public CatalogDbContext OpenAnother() => new(Options());

    public async ValueTask DisposeAsync()
    {
        await Db.DisposeAsync();
        SqliteConnection.ClearAllPools();

        TryDelete(_path);
        TryDelete(_path + "-wal");
        TryDelete(_path + "-shm");
    }

    private DbContextOptions<CatalogDbContext> Options() =>
        new DbContextOptionsBuilder<CatalogDbContext>()
            .UseSqlite($"Data Source={_path};Default Timeout=30")
            .Options;

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
