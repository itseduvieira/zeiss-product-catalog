namespace ProductCatalog.Api.Domain;

public static class CategoryRules
{
    public const int NameMaxLength = 80;
    public const int DescriptionMaxLength = 400;

    public const string UncategorizedName = "Uncategorized";
    public const string UncategorizedDescription = "Products without a category";
}
