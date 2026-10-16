using ProductCatalog.Api.Contracts;
using ProductCatalog.Api.Data;
using ProductCatalog.Api.Domain;
using ProductCatalog.Api.Services;
using ProductCatalog.Api.Validation;

namespace ProductCatalog.UnitTests;

public class CategoryServiceTests
{
    [Fact]
    public async Task List_counts_the_products_in_each_category()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        var categories = await service.GetAllAsync();

        Assert.Equal(["Microscopes", "Optics", "Accessories"], categories.Select(c => c.Name));
        Assert.Equal([2, 3, 3], categories.Select(c => c.ProductCount));
    }

    [Fact]
    public async Task Get_returns_one_category_or_throws_not_found()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        var optics = await service.GetAsync(2);

        Assert.Equal("Optics", optics.Name);
        Assert.Equal(3, optics.ProductCount);
        await Assert.ThrowsAsync<NotFoundException>(() => service.GetAsync(999));
    }

    [Fact]
    public async Task Create_trims_the_name_and_starts_with_no_products()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        var created = await service.CreateAsync(new CategoryRequest { Name = "  Lenses  ", Description = " Spectacle lenses " });

        Assert.Equal("Lenses", created.Name);
        Assert.Equal("Spectacle lenses", created.Description);
        Assert.Equal(0, created.ProductCount);
    }

    [Fact]
    public async Task Create_rejects_a_name_that_exists_in_any_case_and_names_the_existing_one()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        var conflict = await Assert.ThrowsAsync<ConflictException>(() => service.CreateAsync(new CategoryRequest { Name = "OPTICS" }));

        Assert.Equal("A category named Optics already exists.", conflict.Message);
    }

    [Fact]
    public async Task Create_rejects_a_blank_or_too_long_name()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreateAsync(new CategoryRequest { Name = "   " }));
        await Assert.ThrowsAsync<ValidationFailedException>(() =>
            service.CreateAsync(new CategoryRequest { Name = new string('x', CategoryRules.NameMaxLength + 1) }));
    }

    [Fact]
    public async Task Update_renames_and_keeps_the_products()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        var updated = await service.UpdateAsync(2, new CategoryRequest { Name = "Objectives and optics", Description = "Lenses" });

        Assert.Equal("Objectives and optics", updated.Name);
        Assert.Equal(3, updated.ProductCount);
    }

    [Fact]
    public async Task Update_may_keep_its_own_name_but_not_take_another_one()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        var same = await service.UpdateAsync(2, new CategoryRequest { Name = "optics", Description = "Same name, other case" });

        Assert.Equal("optics", same.Name);
        await Assert.ThrowsAsync<ConflictException>(() => service.UpdateAsync(2, new CategoryRequest { Name = "Microscopes" }));
        await Assert.ThrowsAsync<NotFoundException>(() => service.UpdateAsync(999, new CategoryRequest { Name = "Ghost" }));
    }

    [Fact]
    public async Task Delete_refuses_a_category_with_products_and_removes_an_empty_one()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        var conflict = await Assert.ThrowsAsync<ConflictException>(() => service.DeleteAsync(2, moveTo: null));
        Assert.Equal("Optics has 3 products. Move or delete them first.", conflict.Message);

        var empty = await service.CreateAsync(new CategoryRequest { Name = "Lenses" });
        await service.DeleteAsync(empty.Id, moveTo: null);

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetAsync(empty.Id));
    }

    [Fact]
    public async Task Ensure_uncategorized_creates_it_once_and_the_list_flags_it()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        var first = await service.EnsureUncategorizedAsync();
        var second = await service.EnsureUncategorizedAsync();

        Assert.Equal(first, second);
        var categories = await service.GetAllAsync();
        Assert.Single(categories, c => c.IsUncategorized);
        Assert.Equal("Uncategorized", categories.Single(c => c.IsUncategorized).Name);
        Assert.DoesNotContain(categories, c => c.IsUncategorized && c.Id != first);
    }

    [Fact]
    public async Task Uncategorized_cannot_be_deleted_or_renamed_but_its_description_can_change()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);
        var id = await service.EnsureUncategorizedAsync();

        await Assert.ThrowsAsync<ConflictException>(() => service.DeleteAsync(id, moveTo: 1));
        await Assert.ThrowsAsync<ConflictException>(() => service.UpdateAsync(id, new CategoryRequest { Name = "Misc" }));

        var updated = await service.UpdateAsync(id, new CategoryRequest { Name = "Uncategorized", Description = "Sort these later" });
        Assert.Equal("Sort these later", updated.Description);
    }

    [Fact]
    public async Task Delete_can_move_the_products_to_uncategorized_first()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);
        var uncategorizedId = await service.EnsureUncategorizedAsync();

        await service.DeleteAsync(2, moveTo: uncategorizedId);

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetAsync(2));
        var uncategorized = (await service.GetAllAsync()).Single(c => c.IsUncategorized);
        Assert.Equal(3, uncategorized.ProductCount);
        await using var check = db.OpenAnother();
        Assert.All(check.Products.Where(p => p.Id == 100003 || p.Id == 100004 || p.Id == 100008),
            product => Assert.Equal(uncategorized.Id, product.CategoryId));
    }

    [Fact]
    public async Task Delete_can_move_the_products_to_another_category()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        await service.DeleteAsync(2, moveTo: 1);

        var microscopes = await service.GetAsync(1);
        Assert.Equal(5, microscopes.ProductCount);
        await Assert.ThrowsAsync<NotFoundException>(() => service.GetAsync(2));
    }

    [Fact]
    public async Task Delete_refuses_to_move_the_products_to_the_same_or_a_missing_category()
    {
        await using var db = new TestDb();
        var service = CreateService(db.Db);

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.DeleteAsync(2, moveTo: 2));
        await Assert.ThrowsAsync<ValidationFailedException>(() => service.DeleteAsync(2, moveTo: 999));
        Assert.Equal(3, (await service.GetAsync(2)).ProductCount);
    }

    private static CategoryService CreateService(CatalogDbContext db) => new(db, new CategoryRequestValidator());
}
