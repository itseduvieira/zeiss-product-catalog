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
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddValidatorsFromAssemblyContaining<CreateProductRequestValidator>();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()));

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

builder.Services.AddHttpLogging();
var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseAuthorization();
app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();
    CatalogConnection.DeleteDatabaseIfHistoryIsUnknown(connectionString, db.Database.GetMigrations());
    db.Database.Migrate();
    await scope.ServiceProvider.GetRequiredService<ICategoryService>().EnsureUncategorizedAsync();
}

app.UseHttpLogging();
app.Run();

public partial class Program { }
