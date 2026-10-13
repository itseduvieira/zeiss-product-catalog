namespace ProductCatalog.Api.Domain;

public readonly record struct Money(long MinorUnits)
{
    public const int Scale = 2;

    private const decimal CentsPerEuro = 100m;

    public decimal Amount => MinorUnits / CentsPerEuro;

    public static Money FromAmount(decimal amount)
    {
        var cents = decimal.Round(amount * CentsPerEuro, 0, MidpointRounding.AwayFromZero);
        return new Money((long)cents);
    }
}
