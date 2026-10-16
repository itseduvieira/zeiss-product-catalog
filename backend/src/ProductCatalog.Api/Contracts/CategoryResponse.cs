namespace ProductCatalog.Api.Contracts;

public sealed class CategoryResponse
{
    public int Id { get; set; }

    public string Name { get; set; } = "";

    public string Description { get; set; } = "";

    public int ProductCount { get; set; }

    public bool IsUncategorized { get; set; }
}
