using System.Text.Json;

namespace ProductCatalog.BddTests.Support;

public sealed class ApiSession
{
    public HttpResponseMessage? Response { get; set; }

    public string Raw { get; set; } = "";

    public JsonElement Body { get; set; }

    public bool HasBody { get; set; }

    public int? RememberedId { get; set; }
}
