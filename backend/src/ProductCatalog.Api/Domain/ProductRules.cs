namespace ProductCatalog.Api.Domain;

public static class ProductRules
{
    public const int MinId = 100_000;
    public const int MaxId = 999_999;

    public const int NameMaxLength = 120;
    public const int DescriptionMaxLength = 2_000;

    public const decimal MaxPrice = 1_000_000m;
    public const int MaxStock = 1_000_000;
}
