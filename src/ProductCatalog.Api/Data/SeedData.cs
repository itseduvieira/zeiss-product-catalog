using ProductCatalog.Api.Domain;

namespace ProductCatalog.Api.Data;

public static class SeedData
{
    public static readonly DateTime SeededAt = new(2024, 6, 1, 8, 0, 0, DateTimeKind.Utc);

    public const int LastSeededProductId = 100008;

    public static Category[] Categories() =>
    [
        new Category
        {
            Id = 1,
            Name = "Microscopes",
            Description = "Upright and stereo microscopes"
        },
        new Category
        {
            Id = 2,
            Name = "Optics",
            Description = "Objectives, eyepieces and cameras"
        },
        new Category
        {
            Id = 3,
            Name = "Accessories",
            Description = "Illumination, covers and calibration"
        }
    ];

    public static Product[] Products() =>
    [
        Item(100001, "Primo Star", "Upright microscope used in teaching labs.", 2450.00m, 6, 1),
        Item(100002, "Stemi 305", "Compact stereo microscope with an integrated camera.", 1890.00m, 4, 1),
        Item(100003, "Axiocam 208 color", "Microscope camera for routine color imaging.", 3200.00m, 2, 2),
        Item(100004, "Plan-Apochromat 20x", "High-resolution objective.", 4100.50m, 8, 2),
        Item(100005, "Stage micrometer", "Calibration slide, 1 mm scale.", 85.00m, 40, 3),
        Item(100006, "Dust cover", "Soft cover for an upright stand.", 29.90m, 15, 3),
        Item(100007, "LED illuminator", "Replacement transmitted-light source.", 210.00m, 0, 3),
        Item(100008, "Eyepiece 10x/23", "Widefield eyepiece.", 160.00m, 12, 2)
    ];

    private static Product Item(int id, string name, string description, decimal price, int stock, int categoryId) =>
        new()
        {
            Id = id,
            Name = name,
            Description = description,
            Price = price,
            Stock = stock,
            CategoryId = categoryId,
            CreatedAt = SeededAt,
            UpdatedAt = SeededAt
        };
}
