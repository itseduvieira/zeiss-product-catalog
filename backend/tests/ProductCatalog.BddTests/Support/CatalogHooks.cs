using Reqnroll;

namespace ProductCatalog.BddTests.Support;

[Binding]
public sealed class CatalogHooks
{
    [BeforeTestRun]
    public static void Start()
    {
        _ = new CatalogApp();
    }

    [AfterTestRun]
    public static void Stop()
    {
        CatalogApp.Current.Dispose();
    }

    [BeforeScenario]
    public async Task Reset()
    {
        await CatalogApp.Current.ResetAsync();
    }
}
