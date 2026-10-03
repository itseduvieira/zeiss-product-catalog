namespace ProductCatalog.Api.Services;

public interface IProductIdGenerator
{
    Task<int> NextAsync(CancellationToken cancellationToken = default);
}
