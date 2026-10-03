using Microsoft.EntityFrameworkCore;
using ProductCatalog.Api.Domain;

namespace ProductCatalog.Api.Data;

public class CatalogDbContext : DbContext
{
    public CatalogDbContext(DbContextOptions<CatalogDbContext> options) : base(options)
    {
    }

    public DbSet<Product> Products => Set<Product>();

    public DbSet<Category> Categories => Set<Category>();

    public DbSet<IdSequence> IdSequences => Set<IdSequence>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Category>(category =>
        {
            category.Property(c => c.Name).HasMaxLength(80).IsRequired();
            category.Property(c => c.Description).HasMaxLength(400);
            category.HasIndex(c => c.Name).IsUnique();
            category.HasData(SeedData.Categories());
        });

        modelBuilder.Entity<IdSequence>(sequence =>
        {
            sequence.HasKey(s => s.Name);
            sequence.Property(s => s.Name).HasMaxLength(40);
            sequence.HasData(new IdSequence
            {
                Name = IdSequence.ProductName,
                LastValue = SeedData.LastSeededProductId
            });
        });

        modelBuilder.Entity<Product>(product =>
        {
            product.Property(p => p.Id).ValueGeneratedNever();
            product.Property(p => p.Name).HasMaxLength(ProductRules.NameMaxLength).IsRequired();
            product.Property(p => p.Description).HasMaxLength(ProductRules.DescriptionMaxLength);
            product.Property(p => p.Price).HasPrecision(18, 2);

            product.HasOne(p => p.Category)
                .WithMany(c => c.Products)
                .HasForeignKey(p => p.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            product.HasIndex(p => p.Name);
            product.HasIndex(p => p.Stock);
            product.HasData(SeedData.Products());
        });
    }
}
