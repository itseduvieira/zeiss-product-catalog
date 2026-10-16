# Product Catalog API

REST API for product records, stock changes, and catalog queries.

![.NET](https://img.shields.io/badge/.NET-10.0-512BD4)
![API](https://img.shields.io/badge/API-v1-0A7CFF)

## Overview

The Product Catalog API stores products in a SQLite database and exposes them over HTTP. It covers the usual create, read, update, and delete operations, plus stock adjustments, a name search, a stock-range query, and managing the categories products belong to. Product ids are 6-digit integers taken from a database sequence, so two processes that share one database file do not receive the same id. It is for backend developers who build or review ASP.NET Core services and want a small catalog API with EF Core migrations, validation, and container manifests.

## Deployment

The source is at [itseduvieira/zeiss-product-catalog](https://github.com/itseduvieira/zeiss-product-catalog).

An Azure DevOps pipeline builds the API, runs `dotnet test`, and deploys it to Azure App Service. The pipeline file is `azure-pipelines.yml`. The App Service name is `zeiss-product-catalog`, in Spain Central, and it runs one Linux instance on .NET 10.

The live API is at [https://zeiss-product-catalog-fvaqa4fcccdpcga7.spaincentral-01.azurewebsites.net/api/products](https://zeiss-product-catalog-fvaqa4fcccdpcga7.spaincentral-01.azurewebsites.net/api/products). Swagger is at [/swagger](https://zeiss-product-catalog-fvaqa4fcccdpcga7.spaincentral-01.azurewebsites.net/swagger). The root URL returns 404 because the API has no page there.

Local start, Docker, Kubernetes, and the Azure pipeline are in **Installation** below.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download) 10.0.100 or a later 10.0 patch. `global.json` sets `rollForward` to `latestMinor`.
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose, if you start the container.
- `kubectl` and a local Kubernetes cluster, if you apply the manifests in `deploy/k8s/backend`. Docker Desktop can provide that cluster.

## Installation

Clone the repository, then start it in one of the three ways below. Every command below runs from the `backend` folder, which holds this file.

### Local

Start the API:

```bash
dotnet run --project src/ProductCatalog.Api
```

The process listens at `http://localhost:5158`. On startup it applies the EF Core migrations, creates `src/ProductCatalog.Api/catalog.db` when that file is missing, and inserts 3 categories and 8 products. Every start also makes sure an **Uncategorized** category exists.

In VS Code, open the repository folder, choose **API** in Run and Debug, and press F5. It builds the project, starts it on the same port, and opens Swagger.

Swagger is at [http://localhost:5158/swagger](http://localhost:5158/swagger) when `ASPNETCORE_ENVIRONMENT` is `Development`. The launch profile sets that value. `src/ProductCatalog.Api/ProductCatalog.Api.http` contains one request for each endpoint.

### Docker and Kubernetes

The Docker image is not tied to Azure. Any cloud that can run a container can run this image.

With Docker Compose:

```bash
docker compose up --build
```

Compose publishes host port 5158 to container port 8080. The database file inside the container is `/data/catalog.db`, stored in the `catalog-data` volume.

On a local Kubernetes cluster. The manifests for the API and the frontend are in `deploy/k8s` at the repository root:

```bash
docker compose build
kubectl apply -f ../deploy/k8s/backend
kubectl port-forward svc/product-catalog-api 5158:8080
```

The image tag is `product-catalog-api:local`. The Deployment runs one replica and mounts a 1Gi volume at `/data`. Compose and the Deployment set `ASPNETCORE_ENVIRONMENT` to `Development`.

### Azure

Create an App Service in Azure. Create a pipeline in Azure DevOps. Link the Azure subscription to that pipeline with a service connection.

`azure-pipelines.yml` builds the API, runs the tests, and deploys it to that App Service. It runs only when a file under `backend/` changes on `main`. In the Azure DevOps pipeline settings, the YAML file path must be `backend/azure-pipelines.yml`. The live site is listed under **Deployment**.

Change these two fields in that file so they match your subscription and your app:

```yaml
azureSubscription: azure-catalog
appName: zeiss-product-catalog
```

`azureSubscription` is the Azure DevOps service connection. `appName` is the App Service name, not the public URL.

The frontend on Azure Static Web Apps calls this App Service from the browser, so the API must allow its address. In the App Service, add the application setting `Cors__AllowedOrigins__0` with the Static Web App URL, for example `https://<name>.azurestaticapps.net`.

## Configuration

No environment variable is required to start the API. Set these when you need a different database file, port, or host environment.


| Variable                     | Required | Default                                                                 | Description                                                                                                                                                        |
| ---------------------------- | -------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ConnectionStrings__Catalog` | No       | `Data Source=catalog.db`                                                | SQLite connection string. A relative data-source path is resolved from the content root. If the busy timeout is below 30 seconds, the API raises it to 30 seconds. |
| `ASPNETCORE_ENVIRONMENT`     | No       | `Production`, unless the launch profile or container sets `Development` | `Development` turns Swagger on. Other values leave Swagger off.                                                                                                    |
| `ASPNETCORE_HTTP_PORTS`      | No       | `8080` in the ASP.NET container image                                   | TCP port inside the container. The local `dotnet run` profile binds `http://localhost:5158` instead.                                                               |
| `ASPNETCORE_URLS`            | No       | Unset                                                                   | Full listen URL. When set, it overrides the launch-profile URL.                                                                                                    |
| `Cors__AllowedOrigins__0`    | No       | Unset, so no browser origin is allowed                                  | A browser origin that may call the API, such as the Static Web App URL. Add `__1`, `__2`, and so on for more origins.                                              |


To recreate the local database, stop the API and delete `src/ProductCatalog.Api/catalog.db`. The next start applies the migration and writes the seed again. Startup also deletes a database file whose migration history names a migration this build does not contain, then seeds that file again. For Compose, `docker compose down -v` deletes the `catalog-data` volume.

## Usage

List the seeded catalog. Every item includes `stock`.

```bash
# Returns the 8 seed products, including stock for each one.
curl -s http://localhost:5158/api/products
```

Create a product. The API assigns the id. Category `3` is Accessories.

```bash
# Status 201. The response body contains the new 6-digit id and the stored stock.
curl -s -D - -X POST http://localhost:5158/api/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"Lens cloth","description":"Microfiber","price":12.5,"stock":20,"categoryId":3}'
```

Remove stock from a seed product. Product `100007` starts at stock `0`, so this call returns 409.

```bash
# Status 200 and the updated product when enough stock remains.
# Status 409 when the quantity is larger than the current stock.
curl -s -D - -X POST http://localhost:5158/api/products/100007/decrement-stock/1
```

## API reference


| Path                                            | Method | Description                                                               |
| ----------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| `/api/products`                                 | GET    | List products. Each item includes `stock`.                                |
| `/api/products`                                 | POST   | Create a product. The id is generated. Status 201.                        |
| `/api/products/{id}`                            | GET    | Fetch one product. Status 404 when the id is unknown.                     |
| `/api/products/{id}`                            | PUT    | Replace name, description, price, stock, and category.                    |
| `/api/products/{id}`                            | DELETE | Delete the product. Status 204.                                           |
| `/api/products/{id}/decrement-stock/{quantity}` | POST   | Subtract `quantity` from stock. Status 409 when stock is too low.         |
| `/api/products/{id}/add-to-stock/{quantity}`    | POST   | Add `quantity` to stock. Status 409 when the result would exceed 1000000. |
| `/api/products/search?name={name}`              | GET    | Case-insensitive partial match on the name, the category name, or the product number. |
| `/api/products/stock-level?min={min}&max={max}` | GET    | Products whose stock is from `min` through `max`, inclusive.              |
| `/api/categories`                               | GET    | The categories, each with `productCount` and `isUncategorized`. Use one of these ids when you create a product. |
| `/api/categories/{id}`                          | GET    | Fetch one category with its `productCount`. Status 404 when the id is unknown. |
| `/api/categories`                               | POST   | Create a category. Status 201, or 409 when the name is taken.             |
| `/api/categories/{id}`                          | PUT    | Rename a category or change its description. Status 409 when the name is taken. |
| `/api/categories/{id}`                          | DELETE | Delete a category. Status 204, or 409 while products still use it. With `?moveProducts=true`, its products move to Uncategorized first. |


Create and update body:

```json
{
  "name": "Lens cloth",
  "description": "Microfiber",
  "price": 12.5,
  "stock": 20,
  "categoryId": 3
}
```

Validation rules:

- `name` is not blank and has at most 120 characters.
- `description` is optional and has at most 2000 characters.
- `price` must be more than 0, at most 1000000, and it can have at most 2 decimal places. The database stores the euro amount as integer cents.
- `stock` is from 0 through 1000000. If the JSON omits `stock`, the API stores 0.
- `categoryId` must match a category row. The seed ids are `1` Microscopes, `2` Optics, and `3` Accessories.

Category body and rules:

```json
{
  "name": "Lenses",
  "description": "Spectacle lenses"
}
```

- `name` is not blank, has at most 80 characters, and is unique, whatever its case.
- `description` is optional and has at most 400 characters.
- A category that products still use cannot be deleted, unless the delete moves its products to Uncategorized. The move and the delete happen in one transaction.
- **Uncategorized** always exists. It cannot be deleted or renamed, but its description can change. It needs no migration: the API creates it on start when it is missing, and knows it by its name.

If `name`, `price`, or `categoryId` is missing, the API returns 400. A stock quantity of 0 or less also returns 400. Unknown products return 404. If stock changes during a decrement or add, the API returns 409.

Validation and not-found responses use `application/problem+json`. Field errors are in `errors`.

Product ids run from `100000` through `999999`. They are not database identity values. `IdSequences` stores the last issued id, and the next id comes from one `UPDATE ... RETURNING` in the same transaction as the insert. A failed create rolls that id back. After `999999`, create returns 503. Seed product ids `100001`–`100008` are already used. Two processes that share one database file cannot take the same id. Two separate SQLite files can.

SQLite allows one writer. A second process waits up to 30 seconds. The Kubernetes Deployment stays at one replica for that reason. Decrement and add use a conditional update, so two requests cannot both take the last unit. `PUT` writes the stock value from the body, and two such requests can overwrite each other.

Each product belongs to one category. The database rejects deletion of a category that a product still uses. The API does not expose a category delete endpoint.

## Architecture

### Design

The API uses MVC so the HTTP layer stays separate from the product rules. `ProductsController` and `CategoriesController` take the call and return the status code. `ProductService` and `CategoryService` hold the rules. Each product belongs to one category, and `productCount` comes from that relationship. `ProductResponse` is the JSON the caller receives, and each list item includes `stock`.

A request comes in over HTTP. The controller calls `ProductService`. That service checks the input, then reads and writes the database context. The context uses SQLite. The service returns a product or a list. The controller sends that result back as JSON.

`ProductIdGenerator` gets the next product id from the database. FluentValidation checks create and update bodies before anything is saved. `ExceptionHandlingMiddleware` turns errors into HTTP status codes: 400, 404, 409, or 503.

```
HTTP → Controller → ProductService → CatalogDbContext → SQLite
                         │
                         ├─ FluentValidation
                         └─ ProductIdGenerator
```

### Requirements

The assessment asks for a product API with these rules:

- The usual create, read, update, and delete calls, plus four more: remove stock, add stock, search by name, and list by stock range. All nine paths are in **API reference**.
- The product id is created by the API. It is a unique 6-digit number. Two copies of the API running at the same time must not hand out the same id.
- Create and update must reject a body that is missing a required field or has a bad value.
- Every product has its own id. Every list of products includes the stock of each product.
- The database is built with EF Core migrations from the C# model. Extra fields and links between tables are allowed.
- The database starts with seed data so the list calls return products right away.

### Decisions

The API accepts `price` as a decimal, because a double cannot store values such as 0.10 exactly. Every amount is euro. SQLite stores that amount as integer cents in `PriceMinorUnits`, so a range compares numbers. Another currency would be a later change.

There is no repository and no DAO. `CatalogDbContext` already reads and writes the database. `ProductService` uses that context. One extra wrapper class would only repeat the same calls.

The app uses dependency injection so each class receives the services it needs from `Program`, and each web request gets its own database context.

Error responses use `Content-Type: application/problem+json` so every failure has the same shape. A validation error also includes `errors`, with one entry per field. Successful responses stay `application/json`.

## Room for improvement

### Authentication

Every endpoint is open. `Program.cs` calls `UseAuthorization()`, but no authentication scheme is registered and no endpoint has `[Authorize]`. Anyone who can reach the API, including the live Azure URL, can create, change, and delete products. CORS does not stop this: it only limits which websites a browser lets call the API, and tools such as `curl` ignore it.

- Accept JWT bearer tokens from Microsoft Entra ID with `Microsoft.Identity.Web` (`AddMicrosoftIdentityWebApi`), and require them with `[Authorize]`.
- Separate reading from writing with roles, for example a reader role for the `GET` endpoints and a stock editor role for create, update, delete, and stock changes.
- Return 401 for a missing or invalid token and 403 for a missing role, as `application/problem+json` like the other errors.
- Add the sign-in flow to Swagger, so the endpoints can still be tried there.
- Add BDD scenarios for an anonymous caller, a reader, and an editor.

### Observability: logs, metrics, and alerts

The API writes logs to the console through `ILogger`. `ExceptionHandlingMiddleware` logs a warning for each 409 and an error for each 503 and 500. There are no metrics, no traces, no health endpoint, and no alerts. The Kubernetes probes only check that port 8080 accepts a TCP connection, so a running process with a broken database still counts as healthy.

- Send logs, request traces, database calls, and metrics to Application Insights with the Azure Monitor OpenTelemetry package (`Azure.Monitor.OpenTelemetry.AspNetCore`, `UseAzureMonitor()`). It reads the `APPLICATIONINSIGHTS_CONNECTION_STRING` setting.
- Add a `/health` endpoint with `AddHealthChecks().AddDbContextCheck<CatalogDbContext>()`. Point the Kubernetes readiness and liveness probes and the App Service health check at it.
- Log business events as structured fields, not only errors: each stock change with the product id and quantity, and each 409 with its reason, so they can be queried.
- Create Azure Monitor alert rules, for example on a rise in 5xx responses, on slow responses, on a failing availability test against `/health`, and on a product reaching 0 stock. Send them to an action group that emails the team or posts to Teams.

### Messaging and cache

A change only exists in the API's database. Other systems cannot react to it, open screens learn about it only when they ask again, and every read goes to SQLite.

- **Events:** publish an event for each change (product created, updated, or deleted, stock changed) to Azure Service Bus. Other systems, such as reordering or an ERP, can subscribe. Save the event in the same database transaction as the change and publish it from a background worker. This is the outbox pattern: a change is never saved without its event, or the other way round.
- **Live updates:** add a SignalR hub (`MapHub`) that tells connected screens which product changed, fed by the same events. On App Service, turn on WebSockets. With more than one instance, use Azure SignalR Service so every instance reaches every client.
- **Cache:** the frontend asks for the full product list every 15 seconds for each open screen, and the list endpoints have no paging. ASP.NET Core output caching (`AddOutputCache`) can answer repeated `GET` requests from memory and drop the cached lists when a product changes, by evicting a tag. A memory cache is separate on each instance, so with more than one instance use Azure Cache for Redis.
- **Scale:** SQLite allows one writer, which is why the Kubernetes Deployment runs one replica. Running several instances also needs a server database, such as Azure SQL Database or Azure Database for PostgreSQL.

## Contributing

1. Branch from the default branch. Use `feature/<short-name>` for a change and `fix/<short-name>` for a defect.
2. Keep the change limited to that branch name.
3. Run the tests from the `backend` folder:

```bash
dotnet test
```

Unit tests in `tests/ProductCatalog.UnitTests` cover id allocation, validation, stock rules, and concurrent updates. BDD tests in `tests/ProductCatalog.BddTests` call the API over HTTP with Reqnroll.

1. Open a pull request into the default branch. Describe the behavior change and the test result.

After a model change, add an EF Core migration from the `backend` folder:

```bash
dotnet tool restore
dotnet ef migrations add <Name> --project src/ProductCatalog.Api --startup-project src/ProductCatalog.Api --output-dir Data/Migrations
```

