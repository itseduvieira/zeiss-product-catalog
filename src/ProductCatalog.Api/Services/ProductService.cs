using FluentValidation;
using Microsoft.EntityFrameworkCore;
using ProductCatalog.Api.Contracts;
using ProductCatalog.Api.Data;
using ProductCatalog.Api.Domain;

namespace ProductCatalog.Api.Services;

public sealed class ProductService : IProductService
{
    private readonly CatalogDbContext _db;
    private readonly IProductIdGenerator _ids;
    private readonly IValidator<CreateProductRequest> _createValidator;
    private readonly IValidator<UpdateProductRequest> _updateValidator;

    public ProductService(
        CatalogDbContext db,
        IProductIdGenerator ids,
        IValidator<CreateProductRequest> createValidator,
        IValidator<UpdateProductRequest> updateValidator)
    {
        _db = db;
        _ids = ids;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
    }

    public async Task<IReadOnlyList<ProductResponse>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var products = await Query().OrderBy(p => p.Id).ToListAsync(cancellationToken);
        return products.Select(Map).ToList();
    }

    public async Task<ProductResponse> GetAsync(int id, CancellationToken cancellationToken = default)
    {
        var product = await Query().FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null)
            throw new NotFoundException($"Product {id} was not found.");

        return Map(product);
    }

    public async Task<IReadOnlyList<ProductResponse>> SearchByNameAsync(string? name, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ValidationFailedException("name", "A name, or part of one, is required.");

        var term = name.Trim();
        if (term.Length > ProductRules.NameMaxLength)
        {
            throw new ValidationFailedException(
                "name",
                $"Name filter cannot be longer than {ProductRules.NameMaxLength} characters.");
        }

        var lowered = term.ToLowerInvariant();
        var products = await Query()
            .Where(p => p.Name.ToLower().Contains(lowered))
            .OrderBy(p => p.Id)
            .ToListAsync(cancellationToken);

        return products.Select(Map).ToList();
    }

    public async Task<IReadOnlyList<ProductResponse>> GetByStockLevelAsync(int? min, int? max, CancellationToken cancellationToken = default)
    {
        if (min is null || max is null || min < 0 || max < 0 || min > max)
        {
            throw new ValidationFailedException(
                "min",
                "Stock range is invalid. Pass both min and max, with 0 <= min <= max.");
        }

        var lower = min.Value;
        var upper = max.Value;
        var products = await Query()
            .Where(p => p.Stock >= lower && p.Stock <= upper)
            .OrderBy(p => p.Stock)
            .ThenBy(p => p.Id)
            .ToListAsync(cancellationToken);

        return products.Select(Map).ToList();
    }

    public async Task<ProductResponse> CreateAsync(CreateProductRequest request, CancellationToken cancellationToken = default)
    {
        await ValidateAsync(_createValidator, request, cancellationToken);
        await EnsureCategoryExistsAsync(request.CategoryId, cancellationToken);

        var now = DateTime.UtcNow;
        var product = new Product
        {
            Name = request.Name!.Trim(),
            Description = CleanDescription(request.Description),
            Stock = request.Stock,
            CategoryId = request.CategoryId,
            CreatedAt = now,
            UpdatedAt = now
        };
        product.SetPrice(request.Price);

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        product.Id = await _ids.NextAsync(cancellationToken);
        _db.Products.Add(product);
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        await _db.Entry(product).Reference(p => p.Category).LoadAsync(cancellationToken);
        return Map(product);
    }

    public async Task<ProductResponse> UpdateAsync(int id, UpdateProductRequest request, CancellationToken cancellationToken = default)
    {
        await ValidateAsync(_updateValidator, request, cancellationToken);

        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null)
            throw new NotFoundException($"Product {id} was not found.");

        await EnsureCategoryExistsAsync(request.CategoryId, cancellationToken);

        product.Name = request.Name!.Trim();
        product.Description = CleanDescription(request.Description);
        product.SetPrice(request.Price);
        product.Stock = request.Stock;
        product.CategoryId = request.CategoryId;
        product.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);
        await _db.Entry(product).Reference(p => p.Category).LoadAsync(cancellationToken);
        return Map(product);
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        var deleted = await _db.Products
            .Where(p => p.Id == id)
            .ExecuteDeleteAsync(cancellationToken);

        if (deleted == 0)
            throw new NotFoundException($"Product {id} was not found.");
    }

    public async Task<ProductResponse> DecrementStockAsync(int id, int quantity, CancellationToken cancellationToken = default)
    {
        EnsurePositiveQuantity(quantity);

        var product = await _db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null)
            throw new NotFoundException($"Product {id} was not found.");

        if (product.Stock < quantity)
        {
            throw new ConflictException(
                $"Only {product.Stock} in stock for '{product.Name}', cannot remove {quantity}.");
        }

        var now = DateTime.UtcNow;
        var updated = await _db.Products
            .Where(p => p.Id == id && p.Stock >= quantity)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(p => p.Stock, p => p.Stock - quantity)
                .SetProperty(p => p.UpdatedAt, now), cancellationToken);

        if (updated == 0)
            throw new ConflictException("Stock changed while the request was in flight. Try again.");

        return await GetAsync(id, cancellationToken);
    }

    public async Task<ProductResponse> AddToStockAsync(int id, int quantity, CancellationToken cancellationToken = default)
    {
        EnsurePositiveQuantity(quantity);

        var product = await _db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null)
            throw new NotFoundException($"Product {id} was not found.");

        if (quantity > ProductRules.MaxStock || product.Stock > ProductRules.MaxStock - quantity)
        {
            throw new ConflictException($"Stock cannot go above {ProductRules.MaxStock}.");
        }

        var ceiling = ProductRules.MaxStock - quantity;
        var now = DateTime.UtcNow;
        var updated = await _db.Products
            .Where(p => p.Id == id && p.Stock <= ceiling)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(p => p.Stock, p => p.Stock + quantity)
                .SetProperty(p => p.UpdatedAt, now), cancellationToken);

        if (updated == 0)
            throw new ConflictException("Stock changed while the request was in flight. Try again.");

        return await GetAsync(id, cancellationToken);
    }

    private IQueryable<Product> Query() =>
        _db.Products.AsNoTracking().Include(p => p.Category);

    private async Task EnsureCategoryExistsAsync(int categoryId, CancellationToken cancellationToken)
    {
        var exists = await _db.Categories.AnyAsync(c => c.Id == categoryId, cancellationToken);
        if (!exists)
            throw new ValidationFailedException("CategoryId", "Category does not exist.");
    }

    private static void EnsurePositiveQuantity(int quantity)
    {
        if (quantity <= 0)
            throw new ValidationFailedException("quantity", "Quantity has to be greater than zero.");
    }

    private static async Task ValidateAsync<T>(IValidator<T> validator, T model, CancellationToken cancellationToken)
    {
        var result = await validator.ValidateAsync(model, cancellationToken);
        if (result.IsValid)
            return;

        var errors = result.Errors
            .GroupBy(error => error.PropertyName)
            .ToDictionary(
                group => group.Key,
                group => group.Select(error => error.ErrorMessage).Distinct().ToArray());

        throw new ValidationFailedException(errors);
    }

    private static string? CleanDescription(string? description)
    {
        if (string.IsNullOrWhiteSpace(description))
            return null;

        return description.Trim();
    }

    private static ProductResponse Map(Product product) => new()
    {
        Id = product.Id,
        Name = product.Name,
        Description = product.Description,
        Price = product.Price.Amount,
        Stock = product.Stock,
        CategoryId = product.CategoryId,
        CategoryName = product.Category?.Name ?? "",
        CreatedAt = AsUtc(product.CreatedAt),
        UpdatedAt = AsUtc(product.UpdatedAt)
    };

    private static DateTime AsUtc(DateTime value) =>
        value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);
}
