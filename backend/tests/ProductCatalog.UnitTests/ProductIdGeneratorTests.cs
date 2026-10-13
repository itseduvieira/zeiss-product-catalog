using Microsoft.EntityFrameworkCore;
using ProductCatalog.Api.Data;
using ProductCatalog.Api.Domain;
using ProductCatalog.Api.Services;

namespace ProductCatalog.UnitTests;

public class ProductIdGeneratorTests
{
    [Fact]
    public async Task Next_id_follows_the_seeded_products()
    {
        await using var db = new TestDb();
        var generator = new ProductIdGenerator(db.Db);

        var first = await generator.NextAsync();
        var second = await generator.NextAsync();

        Assert.Equal(SeedData.LastSeededProductId + 1, first);
        Assert.Equal(first + 1, second);
        Assert.InRange(first, ProductRules.MinId, ProductRules.MaxId);
    }

    [Fact]
    public async Task A_rolled_back_id_can_be_used_again()
    {
        await using var db = new TestDb();
        var generator = new ProductIdGenerator(db.Db);

        int reserved;
        await using (var transaction = await db.Db.Database.BeginTransactionAsync())
        {
            reserved = await generator.NextAsync();
            await transaction.RollbackAsync();
        }

        var again = await generator.NextAsync();
        Assert.Equal(reserved, again);
    }

    [Fact]
    public async Task Parallel_instances_do_not_share_ids()
    {
        await using var db = new TestDb();
        var ids = new System.Collections.Concurrent.ConcurrentBag<int>();

        var tasks = Enumerable.Range(0, 8).Select(async _ =>
        {
            await using var other = db.OpenAnother();
            var generator = new ProductIdGenerator(other);
            for (var n = 0; n < 5; n++)
            {
                await using var transaction = await other.Database.BeginTransactionAsync();
                ids.Add(await generator.NextAsync());
                await transaction.CommitAsync();
            }
        });

        await Task.WhenAll(tasks);

        Assert.Equal(40, ids.Count);
        Assert.Equal(40, ids.Distinct().Count());
        Assert.All(ids, id => Assert.InRange(id, ProductRules.MinId, ProductRules.MaxId));
    }

    [Fact]
    public async Task The_generator_stops_at_999999()
    {
        await using var db = new TestDb();
        var sequence = await db.Db.IdSequences.SingleAsync(s => s.Name == IdSequence.ProductName);
        sequence.LastValue = ProductRules.MaxId;
        await db.Db.SaveChangesAsync();

        var generator = new ProductIdGenerator(db.Db);

        await Assert.ThrowsAsync<ProductIdExhaustedException>(() => generator.NextAsync());

        db.Db.ChangeTracker.Clear();
        var after = await db.Db.IdSequences.AsNoTracking().SingleAsync(s => s.Name == IdSequence.ProductName);
        Assert.Equal(ProductRules.MaxId, after.LastValue);
    }
}
