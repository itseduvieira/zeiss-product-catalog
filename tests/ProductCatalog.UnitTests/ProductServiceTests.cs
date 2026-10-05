using Microsoft.EntityFrameworkCore;
using ProductCatalog.Api.Contracts;
using ProductCatalog.Api.Data;
using ProductCatalog.Api.Domain;
using ProductCatalog.Api.Services;
using ProductCatalog.Api.Validation;

namespace ProductCatalog.UnitTests;

public class ProductServiceTests
{
    [Fact]
    public void Seeded_ids_match_the_sequence_high_water_mark()
    {
        var products = SeedData.Products();

        Assert.Equal(SeedData.LastSeededProductId, products.Max(p => p.Id));
        Assert.Equal(products.Length, products.Select(p => p.Id).Distinct().Count());
        Assert.All(products, product =>
        {
            Assert.InRange(product.Id, ProductRules.MinId, ProductRules.MaxId);
            Assert.Contains(SeedData.Categories(), category => category.Id == product.CategoryId);
        });
        Assert.Equal(245000, products.Single(product => product.Id == 100001).PriceMinorUnits);
        Assert.Equal(2450.00m, products.Single(product => product.Id == 100001).Price.Amount);
        Assert.Equal(410050, products.Single(product => product.Id == 100004).PriceMinorUnits);
        Assert.Equal(29.90m, products.Single(product => product.Id == 100006).Price.Amount);
    }

    [Fact]
    public async Task List_includes_stock_for_every_product()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        var products = await service.GetAllAsync();

        Assert.Equal(SeedData.Products().Length, products.Count);
        Assert.All(products, product => Assert.True(product.Stock >= 0));
        Assert.Contains(products, product => product.Name == "Primo Star" && product.Stock == 6);
    }

    [Fact]
    public async Task Create_trims_the_name_and_takes_the_next_id()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        var created = await service.CreateAsync(new CreateProductRequest
        {
            Name = "  Lens cloth  ",
            Description = "   ",
            Price = 12.50m,
            Stock = 3,
            CategoryId = 3
        });

        Assert.Equal(SeedData.LastSeededProductId + 1, created.Id);
        Assert.Equal("Lens cloth", created.Name);
        Assert.Null(created.Description);
        Assert.Equal(12.50m, created.Price);
        Assert.Equal(3, created.Stock);
        Assert.Equal("Accessories", created.CategoryName);
    }

    [Fact]
    public async Task Create_rejects_bad_input_without_burning_an_id()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreateAsync(new CreateProductRequest
        {
            Name = "  ",
            Price = 10m,
            Stock = 1,
            CategoryId = 1
        }));

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreateAsync(new CreateProductRequest
        {
            Name = "Broken price",
            Price = 0m,
            Stock = 1,
            CategoryId = 1
        }));

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreateAsync(new CreateProductRequest
        {
            Name = "Too precise",
            Price = 10.555m,
            Stock = 1,
            CategoryId = 1
        }));

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreateAsync(new CreateProductRequest
        {
            Name = "Ghost category",
            Price = 10m,
            Stock = 1,
            CategoryId = 999
        }));

        var sequence = await db.Db.IdSequences.AsNoTracking().SingleAsync();
        Assert.Equal(SeedData.LastSeededProductId, sequence.LastValue);
        Assert.Equal(SeedData.Products().Length, await db.Db.Products.CountAsync());
    }

    [Fact]
    public async Task Update_changes_fields_and_missing_products_404()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        var updated = await service.UpdateAsync(100001, new UpdateProductRequest
        {
            Name = "Primo Star HD",
            Description = "Updated stand.",
            Price = 2599.00m,
            Stock = 6,
            CategoryId = 1
        });

        Assert.Equal("Primo Star HD", updated.Name);
        Assert.Equal(2599.00m, updated.Price);
        Assert.Equal(6, updated.Stock);

        await Assert.ThrowsAsync<NotFoundException>(() => service.UpdateAsync(424242, new UpdateProductRequest
        {
            Name = "Ghost",
            Price = 10m,
            Stock = 1,
            CategoryId = 1
        }));
    }

    [Fact]
    public async Task Delete_removes_the_product()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        await service.DeleteAsync(100006);
        await Assert.ThrowsAsync<NotFoundException>(() => service.GetAsync(100006));
        await Assert.ThrowsAsync<NotFoundException>(() => service.DeleteAsync(100006));
    }

    [Fact]
    public async Task Search_is_a_partial_case_insensitive_match_on_the_name()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        var matches = await service.SearchByNameAsync("STAR");
        Assert.Equal(["Primo Star"], matches.Select(p => p.Name).ToArray());
        Assert.All(matches, product => Assert.True(product.Stock >= 0));

        var none = await service.SearchByNameAsync("not-a-product");
        Assert.Empty(none);

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.SearchByNameAsync("   "));
    }

    [Fact]
    public async Task Stock_range_is_inclusive()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        var matches = await service.GetByStockLevelAsync(2, 4);
        Assert.Equal(["Axiocam 208 color", "Stemi 305"], matches.Select(p => p.Name).ToArray());

        var exact = await service.GetByStockLevelAsync(0, 0);
        Assert.Equal(["LED illuminator"], exact.Select(p => p.Name).ToArray());

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.GetByStockLevelAsync(10, 1));
        await Assert.ThrowsAsync<ValidationFailedException>(() => service.GetByStockLevelAsync(null, 5));
    }

    [Fact]
    public async Task Decrement_refuses_to_go_below_zero_and_leaves_stock_alone()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        var updated = await service.DecrementStockAsync(100005, 5);
        Assert.Equal(35, updated.Stock);

        var conflict = await Assert.ThrowsAsync<ConflictException>(() => service.DecrementStockAsync(100003, 3));
        Assert.Contains("cannot remove", conflict.Message);

        var unchanged = await service.GetAsync(100003);
        Assert.Equal(2, unchanged.Stock);

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.DecrementStockAsync(100001, 0));
        await Assert.ThrowsAsync<NotFoundException>(() => service.DecrementStockAsync(424242, 1));
    }

    [Fact]
    public async Task Add_to_stock_increases_the_available_amount()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        var updated = await service.AddToStockAsync(100007, 4);
        Assert.Equal(4, updated.Stock);

        await Assert.ThrowsAsync<ConflictException>(() => service.AddToStockAsync(100001, ProductRules.MaxStock));
    }

    [Fact]
    public async Task Two_decrements_cannot_oversell_the_last_unit()
    {
        await using var db = new TestDb();
        var product = await db.Db.Products.SingleAsync(p => p.Id == 100007);
        product.Stock = 1;
        await db.Db.SaveChangesAsync();
        db.Db.ChangeTracker.Clear();

        async Task<bool> TryTakeOne()
        {
            await using var other = db.OpenAnother();
            try
            {
                await CreateService(other).DecrementStockAsync(100007, 1);
                return true;
            }
            catch (ConflictException)
            {
                return false;
            }
        }

        var results = await Task.WhenAll(TryTakeOne(), TryTakeOne());

        Assert.Equal(1, results.Count(ok => ok));
        var left = await db.Db.Products.AsNoTracking().SingleAsync(p => p.Id == 100007);
        Assert.Equal(0, left.Stock);
    }

    private static ProductService CreateService(CatalogDbContext db) =>
        new(db, new ProductIdGenerator(db), new CreateProductRequestValidator(), new UpdateProductRequestValidator());
}
