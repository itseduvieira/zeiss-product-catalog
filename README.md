# Product Catalog API

REST API for product records, stock changes, and catalog queries.

![.NET](https://img.shields.io/badge/.NET-10.0-512BD4)
![API](https://img.shields.io/badge/API-v1-0A7CFF)
![license](https://img.shields.io/badge/license-not%20set-lightgrey)

## Overview

The Product Catalog API stores products in a SQLite database and exposes them over HTTP. It covers the usual create, read, update, and delete operations, plus stock adjustments, a name search, and a stock-range query. Product ids are 6-digit integers taken from a database sequence, so two processes that share one database file do not receive the same id. It is for backend developers who build or review ASP.NET Core services and want a small catalog API with EF Core migrations, validation, and container manifests.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download) 10.0.100 or a later 10.0 patch. `global.json` sets `rollForward` to `latestMinor`.
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose, if you start the container.
- `kubectl` and a local Kubernetes cluster, if you apply `deploy/k8s`. Docker Desktop can provide that cluster.

## Installation

This project is not published as an npm, NuGet, or pip package. Clone the repository, then start it from source or from the container image.

From source, in the repository root:

```bash
dotnet run --project src/ProductCatalog.Api
```

The process listens at `http://localhost:5158`. On startup it applies the EF Core migrations, creates `src/ProductCatalog.Api/catalog.db` when that file is missing, and inserts 3 categories and 8 products.

With Docker Compose:

```bash
docker compose up --build
```

Compose publishes host port 5158 to container port 8080. The database file inside the container is `/data/catalog.db`, stored in the `catalog-data` volume.

On a local Kubernetes cluster:

```bash
docker compose build
kubectl apply -f deploy/k8s
kubectl port-forward svc/product-catalog 5158:8080
```

The image tag is `product-catalog-api:local`. The Deployment runs one replica and mounts a 1Gi volume at `/data`.

Swagger is at [http://localhost:5158/swagger](http://localhost:5158/swagger) when `ASPNETCORE_ENVIRONMENT` is `Development`. The launch profile, Compose, and the Deployment all set that value. `src/ProductCatalog.Api/ProductCatalog.Api.http` contains one request for each endpoint.

## Configuration

No environment variable is required to start the API. Set these when you need a different database file, port, or host environment.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `ConnectionStrings__Catalog` | No | `Data Source=catalog.db` | SQLite connection string. A relative data-source path is resolved from the content root. If the busy timeout is below 30 seconds, the API raises it to 30 seconds. |
| `ASPNETCORE_ENVIRONMENT` | No | `Production`, unless the launch profile or container sets `Development` | `Development` turns Swagger on. Other values leave Swagger off. |
| `ASPNETCORE_HTTP_PORTS` | No | `8080` in the ASP.NET container image | TCP port inside the container. The local `dotnet run` profile binds `http://localhost:5158` instead. |
| `ASPNETCORE_URLS` | No | Unset | Full listen URL. When set, it overrides the launch-profile URL. |

To recreate the local database, stop the API and delete `src/ProductCatalog.Api/catalog.db`. The next start applies the migration and writes the seed again. For Compose, `docker compose down -v` deletes the `catalog-data` volume.

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

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/products` | List products. Each item includes `stock`. |
| POST | `/api/products` | Create a product. The id is generated. Status 201. |
| GET | `/api/products/{id}` | Fetch one product. Status 404 when the id is unknown. |
| PUT | `/api/products/{id}` | Replace name, description, price, stock, and category. |
| DELETE | `/api/products/{id}` | Delete the product. Status 204. |
| POST | `/api/products/{id}/decrement-stock/{quantity}` | Subtract `quantity` from stock. Status 409 when stock is too low. |
| POST | `/api/products/{id}/add-to-stock/{quantity}` | Add `quantity` to stock. Status 409 when the result would exceed 1000000. |
| GET | `/api/products/search?name={name}` | Case-insensitive partial match on the name. |
| GET | `/api/products/stock-level?min={min}&max={max}` | Products whose stock is from `min` through `max`, inclusive. |
| GET | `/api/categories` | The seed categories. Use one of these ids when you create a product. |

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
- `price` is greater than 0, at most 1000000, and has at most 2 decimal places.
- `stock` is from 0 through 1000000. If the JSON omits `stock`, the API stores 0.
- `categoryId` must match a category row. The seed ids are `1` Microscopes, `2` Optics, and `3` Accessories.

If `name`, `price`, or `categoryId` is missing, the API returns 400. A stock quantity of 0 or less also returns 400. Unknown products return 404. If stock changes during a decrement or add, the API returns 409.

Validation and not-found responses use `application/problem+json`. Field errors are in `errors`.

Product ids run from `100000` through `999999`. They are not database identity values. `IdSequences` stores the last issued id, and the next id comes from one `UPDATE ... RETURNING` in the same transaction as the insert. A failed create rolls that id back. After `999999`, create returns 503. Seed product ids `100001`–`100008` are already used. Two processes that share one database file cannot take the same id. Two separate SQLite files can.

SQLite allows one writer. A second process waits up to 30 seconds. The Kubernetes Deployment stays at one replica for that reason. Decrement and add use a conditional update, so two requests cannot both take the last unit. `PUT` writes the stock value from the body, and two such requests can overwrite each other.

Each product belongs to one category. The database rejects deletion of a category that a product still uses. The API does not expose a category delete endpoint.

## Contributing

1. Branch from the default branch. Use `feature/<short-name>` for a change and `fix/<short-name>` for a defect.
2. Keep the change limited to that branch name.
3. Run the tests from the repository root:

```bash
dotnet test
```

Unit tests in `tests/ProductCatalog.UnitTests` cover id allocation, validation, stock rules, and concurrent updates. BDD tests in `tests/ProductCatalog.BddTests` call the API over HTTP with Reqnroll.

4. Open a pull request into the default branch. Describe the behavior change and the test result. There is no CI workflow in this repository, so the pull request does not run `dotnet test` for you.

After a model change, add an EF Core migration:

```bash
dotnet tool restore
dotnet ef migrations add <Name> --project src/ProductCatalog.Api --startup-project src/ProductCatalog.Api --output-dir Data/Migrations
```

## License

This repository does not include a license file. No license is granted until a `LICENSE` file is added.
