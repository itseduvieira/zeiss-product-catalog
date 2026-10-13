using Microsoft.AspNetCore.Mvc;
using ProductCatalog.Api.Contracts;
using ProductCatalog.Api.Services;

namespace ProductCatalog.Api.Controllers;

[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    private readonly IProductService _products;

    public ProductsController(IProductService products)
    {
        _products = products;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProductResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var products = await _products.GetAllAsync(cancellationToken);
        return Ok(products);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ProductResponse>> GetById(int id, CancellationToken cancellationToken)
    {
        var product = await _products.GetAsync(id, cancellationToken);
        return Ok(product);
    }

    [HttpGet("search")]
    public async Task<ActionResult<IReadOnlyList<ProductResponse>>> Search([FromQuery] string? name, CancellationToken cancellationToken)
    {
        var products = await _products.SearchByNameAsync(name, cancellationToken);
        return Ok(products);
    }

    [HttpGet("stock-level")]
    public async Task<ActionResult<IReadOnlyList<ProductResponse>>> StockLevel(
        [FromQuery] int? min,
        [FromQuery] int? max,
        CancellationToken cancellationToken)
    {
        var products = await _products.GetByStockLevelAsync(min, max, cancellationToken);
        return Ok(products);
    }

    [HttpPost]
    public async Task<ActionResult<ProductResponse>> Create(CreateProductRequest request, CancellationToken cancellationToken)
    {
        var created = await _products.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ProductResponse>> Update(int id, UpdateProductRequest request, CancellationToken cancellationToken)
    {
        var updated = await _products.UpdateAsync(id, request, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        await _products.DeleteAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:int}/decrement-stock/{quantity:int}")]
    public async Task<ActionResult<ProductResponse>> DecrementStock(int id, int quantity, CancellationToken cancellationToken)
    {
        var product = await _products.DecrementStockAsync(id, quantity, cancellationToken);
        return Ok(product);
    }

    [HttpPost("{id:int}/add-to-stock/{quantity:int}")]
    public async Task<ActionResult<ProductResponse>> AddToStock(int id, int quantity, CancellationToken cancellationToken)
    {
        var product = await _products.AddToStockAsync(id, quantity, cancellationToken);
        return Ok(product);
    }
}
