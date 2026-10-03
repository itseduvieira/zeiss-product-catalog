using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using ProductCatalog.BddTests.Support;
using Reqnroll;

namespace ProductCatalog.BddTests.Steps;

[Binding]
public sealed class ProductSteps
{
    private readonly ApiSession _session;

    public ProductSteps(ApiSession session)
    {
        _session = session;
    }

    [When("I list products")]
    public Task ListProducts() => SendAsync(HttpMethod.Get, "/api/products");

    [When("I list categories")]
    public Task ListCategories() => SendAsync(HttpMethod.Get, "/api/categories");

    [When("I fetch product {int}")]
    public Task Fetch(int id) => SendAsync(HttpMethod.Get, $"/api/products/{id}");

    [When("I search products by name {string}")]
    public Task Search(string name) =>
        SendAsync(HttpMethod.Get, "/api/products/search?name=" + Uri.EscapeDataString(name));

    [When("I ask for products with stock between {int} and {int}")]
    public Task StockLevel(int min, int max) =>
        SendAsync(HttpMethod.Get, $"/api/products/stock-level?min={min}&max={max}");

    [When("I create a product named {string} priced at {string} with stock {int} in category {int}")]
    public Task Create(string name, string price, int stock, int category) =>
        SendAsync(HttpMethod.Post, "/api/products", new
        {
            name,
            price = decimal.Parse(price, CultureInfo.InvariantCulture),
            stock,
            categoryId = category
        });

    [When("I update product {int} with name {string}, price {string}, stock {int} and category {int}")]
    public Task Update(int id, string name, string price, int stock, int category) =>
        SendAsync(HttpMethod.Put, $"/api/products/{id}", new
        {
            name,
            price = decimal.Parse(price, CultureInfo.InvariantCulture),
            stock,
            categoryId = category
        });

    [When("I delete product {int}")]
    public Task Delete(int id) => SendAsync(HttpMethod.Delete, $"/api/products/{id}");

    [When("I decrement stock of product {int} by {int}")]
    public Task Decrement(int id, int quantity) =>
        SendAsync(HttpMethod.Post, $"/api/products/{id}/decrement-stock/{quantity}");

    [When("I add {int} to the stock of product {int}")]
    public Task AddStock(int quantity, int id) =>
        SendAsync(HttpMethod.Post, $"/api/products/{id}/add-to-stock/{quantity}");

    [When("I remember the product id")]
    public void Remember()
    {
        _session.RememberedId = _session.Body.GetProperty("id").GetInt32();
    }

    [Then("the response status is {int}")]
    public void Status(int expected)
    {
        Assert.NotNull(_session.Response);
        var actual = (int)_session.Response.StatusCode;
        Assert.True(actual == expected, $"Expected {expected} but got {actual}. Body: {_session.Raw}");
    }

    [Then("the product name is {string}")]
    public void Name(string name)
    {
        Assert.Equal(name, _session.Body.GetProperty("name").GetString());
    }

    [Then("the available stock is {int}")]
    public void Stock(int stock)
    {
        Assert.Equal(stock, _session.Body.GetProperty("stock").GetInt32());
    }

    [Then("the product id is a 6-digit number")]
    public void SixDigitId()
    {
        var id = _session.Body.GetProperty("id").GetInt32();
        Assert.InRange(id, 100000, 999999);
    }

    [Then("the product id is greater than {int}")]
    public void IdGreaterThan(int min)
    {
        Assert.True(_session.Body.GetProperty("id").GetInt32() > min);
    }

    [Then("the product id is not the one I remembered")]
    public void IdWasNotReused()
    {
        Assert.NotNull(_session.RememberedId);
        Assert.NotEqual(_session.RememberedId, _session.Body.GetProperty("id").GetInt32());
    }

    [Then("the response location header identifies that product")]
    public void Location()
    {
        var id = _session.Body.GetProperty("id").GetInt32();
        var location = _session.Response?.Headers.Location?.ToString();
        Assert.False(string.IsNullOrWhiteSpace(location), "Location header was missing.");
        Assert.Contains($"/api/products/{id}", location, StringComparison.OrdinalIgnoreCase);
    }

    [Then("every product in the list includes a stock figure")]
    public void EveryProductHasStock()
    {
        Assert.True(_session.Body.GetArrayLength() > 0, _session.Raw);
        foreach (var product in _session.Body.EnumerateArray())
        {
            Assert.True(product.TryGetProperty("stock", out var stock), _session.Raw);
            Assert.True(stock.TryGetInt32(out var units) && units >= 0);
        }
    }

    [Then("the list contains {string}")]
    public void ListContains(string name)
    {
        Assert.Contains(Names(), item => item == name);
    }

    [Then("the list does not contain {string}")]
    public void ListOmits(string name)
    {
        Assert.DoesNotContain(Names(), item => item == name);
    }

    [Then("the error payload mentions {string}")]
    public void ErrorMentions(string field)
    {
        Assert.True(_session.HasBody, _session.Raw);
        var errors = _session.Body.GetProperty("errors");
        Assert.True(errors.TryGetProperty(field, out var messages), _session.Raw);
        Assert.True(messages.GetArrayLength() > 0);
    }

    private IEnumerable<string> Names() =>
        _session.Body.EnumerateArray().Select(item => item.GetProperty("name").GetString() ?? "");

    private async Task SendAsync(HttpMethod method, string url, object? body = null)
    {
        using var request = new HttpRequestMessage(method, url);
        if (body is not null)
            request.Content = JsonContent.Create(body);

        _session.Response?.Dispose();
        var response = await CatalogApp.Current.Client.SendAsync(request);
        var raw = await response.Content.ReadAsStringAsync();

        _session.Response = response;
        _session.Raw = raw;
        _session.HasBody = false;
        _session.Body = default;

        var trimmed = raw.TrimStart();
        if (trimmed.StartsWith('{') || trimmed.StartsWith('['))
        {
            using var document = JsonDocument.Parse(raw);
            _session.Body = document.RootElement.Clone();
            _session.HasBody = true;
        }
    }
}
