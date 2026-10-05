using FluentValidation;
using Microsoft.EntityFrameworkCore;
using ProductCatalog.Api.Data;
using ProductCatalog.Api.Middleware;
using ProductCatalog.Api.Services;
using ProductCatalog.Api.Validation;

var builder = WebApplication.CreateBuilder(args);

var connectionString = CatalogConnection.Resolve(
    builder.Configuration.GetConnectionString("Catalog"),
    builder.Environment.ContentRootPath);

builder.Services.AddDbContext<CatalogDbContext>(options => options.UseSqlite(connectionString));
builder.Services.AddScoped<IProductIdGenerator, ProductIdGenerator>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddValidatorsFromAssemblyContaining<CreateProductRequestValidator>();

builder.Services.AddControllers();
builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.OpenApiInfo
    {
        Title = "Product Catalog API",
        Version = "v1",
        Description = "Product CRUD, stock changes, name search and stock-level queries."
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseAuthorization();
app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();
    CatalogConnection.DeleteDatabaseIfHistoryIsUnknown(connectionString, db.Database.GetMigrations());
    db.Database.Migrate();
}

app.Run();

public partial class Program { }
