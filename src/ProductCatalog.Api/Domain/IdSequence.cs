namespace ProductCatalog.Api.Domain;

public class IdSequence
{
    public const string ProductName = "Product";

    public string Name { get; set; } = "";

    public int LastValue { get; set; }
}
