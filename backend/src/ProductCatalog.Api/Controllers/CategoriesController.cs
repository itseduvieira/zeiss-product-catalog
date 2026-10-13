using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProductCatalog.Api.Contracts;
using ProductCatalog.Api.Data;

namespace ProductCatalog.Api.Controllers;

[ApiController]
[Route("api/categories")]
public class CategoriesController : ControllerBase
{
    private readonly CatalogDbContext _db;

    public CategoriesController(CatalogDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CategoryResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var categories = await _db.Categories
            .AsNoTracking()
            .OrderBy(c => c.Id)
            .Select(c => new CategoryResponse
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description
            })
            .ToListAsync(cancellationToken);

        return Ok(categories);
    }
}
