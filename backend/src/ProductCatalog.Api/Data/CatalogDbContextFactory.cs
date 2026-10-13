using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ProductCatalog.Api.Data;

public sealed class CatalogDbContextFactory : IDesignTimeDbContextFactory<CatalogDbContext>
{
    public CatalogDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<CatalogDbContext>()
            .UseSqlite(CatalogConnection.Resolve(null, Directory.GetCurrentDirectory()))
            .Options;

        return new CatalogDbContext(options);
    }
}
