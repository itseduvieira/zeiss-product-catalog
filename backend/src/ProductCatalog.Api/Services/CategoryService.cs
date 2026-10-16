using FluentValidation;
using Microsoft.EntityFrameworkCore;
using ProductCatalog.Api.Contracts;
using ProductCatalog.Api.Data;
using ProductCatalog.Api.Domain;

namespace ProductCatalog.Api.Services;

public sealed class CategoryService : ICategoryService
{
    private readonly CatalogDbContext _db;
    private readonly IValidator<CategoryRequest> _validator;

    public CategoryService(CatalogDbContext db, IValidator<CategoryRequest> validator)
    {
        _db = db;
        _validator = validator;
    }

    public async Task<IReadOnlyList<CategoryResponse>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await Query()
            .OrderBy(c => c.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task<CategoryResponse> GetAsync(int id, CancellationToken cancellationToken = default)
    {
        var category = await Query().FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        return category ?? throw new NotFoundException($"Category {id} was not found.");
    }

    public async Task<CategoryResponse> CreateAsync(CategoryRequest request, CancellationToken cancellationToken = default)
    {
        await ValidateAsync(request, cancellationToken);
        var name = request.Name!.Trim();
        await EnsureNameIsFreeAsync(name, null, cancellationToken);

        var category = new Category
        {
            Name = name,
            Description = request.Description?.Trim() ?? ""
        };
        _db.Categories.Add(category);
        await SaveAsync(name, cancellationToken);

        return await GetAsync(category.Id, cancellationToken);
    }

    public async Task<CategoryResponse> UpdateAsync(int id, CategoryRequest request, CancellationToken cancellationToken = default)
    {
        await ValidateAsync(request, cancellationToken);

        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == id, cancellationToken)
            ?? throw new NotFoundException($"Category {id} was not found.");

        var name = request.Name!.Trim();
        if (IsUncategorized(category.Name) && name != category.Name)
            throw new ConflictException($"{category.Name} cannot be renamed.");

        await EnsureNameIsFreeAsync(name, id, cancellationToken);

        category.Name = name;
        category.Description = request.Description?.Trim() ?? "";
        await SaveAsync(name, cancellationToken);

        return await GetAsync(id, cancellationToken);
    }

    public async Task DeleteAsync(int id, int? moveTo, CancellationToken cancellationToken = default)
    {
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == id, cancellationToken)
            ?? throw new NotFoundException($"Category {id} was not found.");

        if (IsUncategorized(category.Name))
            throw new ConflictException($"{category.Name} cannot be deleted.");

        var productCount = await _db.Products.CountAsync(p => p.CategoryId == id, cancellationToken);
        if (productCount > 0 && moveTo is null)
        {
            var products = productCount == 1 ? "1 product" : $"{productCount} products";
            throw new ConflictException($"{category.Name} has {products}. Move or delete them first.");
        }

        if (productCount > 0)
        {
            if (moveTo == id)
                throw new ValidationFailedException("moveTo", "Choose another category for the products.");
            if (!await _db.Categories.AnyAsync(c => c.Id == moveTo, cancellationToken))
                throw new ValidationFailedException("moveTo", "The category to move the products to does not exist.");
        }

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        if (productCount > 0)
        {
            var now = DateTime.UtcNow;
            await _db.Products
                .Where(p => p.CategoryId == id)
                .ExecuteUpdateAsync(
                    update => update
                        .SetProperty(p => p.CategoryId, moveTo!.Value)
                        .SetProperty(p => p.UpdatedAt, now),
                    cancellationToken);
        }

        _db.Categories.Remove(category);
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<int> EnsureUncategorizedAsync(CancellationToken cancellationToken = default)
    {
        var lowered = CategoryRules.UncategorizedName.ToLowerInvariant();
        var existing = await _db.Categories
            .Where(c => c.Name.ToLower() == lowered)
            .Select(c => (int?)c.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (existing is not null)
            return existing.Value;

        var uncategorized = new Category
        {
            Name = CategoryRules.UncategorizedName,
            Description = CategoryRules.UncategorizedDescription
        };
        _db.Categories.Add(uncategorized);
        await _db.SaveChangesAsync(cancellationToken);
        return uncategorized.Id;
    }

    private static bool IsUncategorized(string name) =>
        string.Equals(name, CategoryRules.UncategorizedName, StringComparison.OrdinalIgnoreCase);

    private IQueryable<CategoryResponse> Query() =>
        _db.Categories
            .AsNoTracking()
            .Select(c => new CategoryResponse
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                ProductCount = c.Products.Count,
                IsUncategorized = c.Name.ToLower() == UncategorizedLowered
            });

    private static readonly string UncategorizedLowered = CategoryRules.UncategorizedName.ToLowerInvariant();

    private async Task ValidateAsync(CategoryRequest request, CancellationToken cancellationToken)
    {
        var result = await _validator.ValidateAsync(request, cancellationToken);
        if (result.IsValid)
            return;

        throw new ValidationFailedException(result.Errors
            .GroupBy(error => error.PropertyName)
            .ToDictionary(
                group => group.Key,
                group => group.Select(error => error.ErrorMessage).Distinct().ToArray()));
    }

    private async Task EnsureNameIsFreeAsync(string name, int? exceptId, CancellationToken cancellationToken)
    {
        var lowered = name.ToLowerInvariant();
        var taken = await _db.Categories
            .Where(c => c.Id != exceptId && c.Name.ToLower() == lowered)
            .Select(c => c.Name)
            .FirstOrDefaultAsync(cancellationToken);

        if (taken is not null)
            throw new ConflictException($"A category named {taken} already exists.");
    }

    private async Task SaveAsync(string name, CancellationToken cancellationToken)
    {
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            throw new ConflictException($"A category named {name} already exists.");
        }
    }
}
