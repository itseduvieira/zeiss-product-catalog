using ProductCatalog.Api.Contracts;

namespace ProductCatalog.Api.Services;

public interface IProductService
{
    Task<IReadOnlyList<ProductResponse>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<ProductResponse> GetAsync(int id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ProductResponse>> SearchByNameAsync(string? name, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ProductResponse>> GetByStockLevelAsync(int? min, int? max, CancellationToken cancellationToken = default);

    Task<ProductResponse> CreateAsync(CreateProductRequest request, CancellationToken cancellationToken = default);

    Task<ProductResponse> UpdateAsync(int id, UpdateProductRequest request, CancellationToken cancellationToken = default);

    Task DeleteAsync(int id, CancellationToken cancellationToken = default);

    Task<ProductResponse> DecrementStockAsync(int id, int quantity, CancellationToken cancellationToken = default);

    Task<ProductResponse> AddToStockAsync(int id, int quantity, CancellationToken cancellationToken = default);
}
