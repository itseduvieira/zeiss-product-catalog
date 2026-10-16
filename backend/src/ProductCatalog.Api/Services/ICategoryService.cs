using ProductCatalog.Api.Contracts;

namespace ProductCatalog.Api.Services;

public interface ICategoryService
{
    Task<IReadOnlyList<CategoryResponse>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<CategoryResponse> GetAsync(int id, CancellationToken cancellationToken = default);

    Task<CategoryResponse> CreateAsync(CategoryRequest request, CancellationToken cancellationToken = default);

    Task<CategoryResponse> UpdateAsync(int id, CategoryRequest request, CancellationToken cancellationToken = default);

    Task DeleteAsync(int id, int? moveTo, CancellationToken cancellationToken = default);

    Task<int> EnsureUncategorizedAsync(CancellationToken cancellationToken = default);
}
