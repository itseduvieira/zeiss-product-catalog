namespace ProductCatalog.Api.Contracts;

public sealed class ProductResponse
{
    public int Id { get; set; }

    public string Name { get; set; } = "";

    public string? Description { get; set; }

    public decimal Price { get; set; }

    public int Stock { get; set; }

    public int CategoryId { get; set; }

    public string CategoryName { get; set; } = "";

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
