namespace ProductCatalog.Api.Domain;

public class Product
{
    public int Id { get; set; }

    public string Name { get; set; } = "";

    public string? Description { get; set; }

    public long PriceMinorUnits { get; private set; }

    public Money Price => new(PriceMinorUnits);

    public int Stock { get; set; }

    public int CategoryId { get; set; }

    public Category Category { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public void SetPrice(decimal amount) => PriceMinorUnits = Money.FromAmount(amount).MinorUnits;
}
