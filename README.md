# Product Catalog

Here you find a product catalog for ZEISS products, such as microscopes, optics, and accessories, with their prices and stock. It is part of the Carl Zeiss Vision assessment for a fullstack position, in .NET and Angular.

## The project

The project is made of two apps:

- **API:** a REST API in C# with ASP.NET Core. It stores the products and their stock, and keeps the rules: unique product ids, valid data, and stock that never goes below zero.
- **Frontend:** a single-page app in Angular that consumes the API. It is where people browse the catalog, find products, edit them, and change their stock.

The apps talk only over HTTP, so each one runs, tests, and deploys on its own. Both are live on Azure: the [app](https://polite-pebble-07b1ba510.5.azurestaticapps.net/) and the [API](https://zeiss-product-catalog-fvaqa4fcccdpcga7.spaincentral-01.azurewebsites.net/swagger).

## How to navigate

- [`backend/`](backend/README.md) holds the API. To run it, see [Installation](backend/README.md#installation). For its endpoints, see [API reference](backend/README.md#api-reference). For its structure, see [Architecture](backend/README.md#architecture).
- [`frontend/`](frontend/README.md) holds the Angular app. To run it, see [Installation](frontend/README.md#installation). For its pages, see [Pages](frontend/README.md#pages). For its structure, see [Architecture](frontend/README.md#architecture).
- `deploy/k8s/` holds the Kubernetes manifests for both apps.
- `.vscode/` runs both apps from VS Code: choose **API**, **App**, or **API + App** in Run and Debug.

Each README ends with **Room for improvement**, the next steps for that app.
