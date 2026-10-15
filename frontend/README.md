# Product Catalog frontend

Angular app for browsing products, changing stock, and editing the catalog.

![Angular](https://img.shields.io/badge/Angular-22-DD0031)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6)

## Overview

The Product Catalog frontend is the browser app for the [Product Catalog API](../backend/README.md). It lists products with their stock, then searches, filters, sorts, and pages them. It creates, edits, and deletes products, and adds or removes stock.

## Deployment

The source is at [itseduvieira/zeiss-product-catalog](https://github.com/itseduvieira/zeiss-product-catalog).

An Azure DevOps pipeline runs `npm test`, builds the app, and deploys the static files to Azure Static Web Apps on the Free plan. The pipeline file is `azure-pipelines.yml`. The app calls the live API on App Service.

The live app is at [https://polite-pebble-07b1ba510.5.azurestaticapps.net](https://polite-pebble-07b1ba510.5.azurestaticapps.net/).

Local start, Docker, Kubernetes, and the Azure pipeline are in **Installation** below.

## Prerequisites

- [Node.js](https://nodejs.org) 24 LTS, with npm.
- The [Product Catalog API](../backend/README.md) running on `http://localhost:5158` for a local start.
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose, if you start the containers.
- `kubectl` and a local Kubernetes cluster, if you apply the manifests in `deploy/k8s/frontend`. Docker Desktop can provide that cluster.

## Installation

Clone the repository, then start the app in one of the three ways below. Every command below runs from the `frontend` folder, which holds this file.

### Local

Start the app:

```bash
npm install
npm start
```

The app is at [http://localhost:4200](http://localhost:4200). The dev server forwards every `/api` request to `http://localhost:5158`, as set in `proxy.conf.json`. The browser sees one origin, so the API needs no CORS setup.

In VS Code, open the repository folder and choose **App** in Run and Debug: it starts the dev server and opens Chrome. **API + App** starts both.

Run the tests, and build for production into `dist/`:

```bash
npm test
npm run build
```

### Docker and Kubernetes

The image builds the app and serves it with nginx on port 8080. nginx forwards every `/api` request to `API_URL`. It also serves `index.html` for any other address, so a link such as `/products/100001` opens the right page.

With Docker Compose. This also starts the API:

```bash
docker compose up --build
```

The app is at [http://localhost:4200](http://localhost:4200), and the API at `http://localhost:5158`. The database is in the `frontend_catalog-data` volume. `docker compose down -v` deletes it.

On a local Kubernetes cluster, start the API first, because nginx looks up its address when it starts:

```bash
docker compose build
kubectl apply -f ../deploy/k8s/backend
kubectl apply -f ../deploy/k8s/frontend
kubectl port-forward svc/product-catalog-web 4200:8080
```

The image tags are `product-catalog-api:local` and `product-catalog-web:local`. The web Deployment runs one replica and sets `API_URL` to `http://product-catalog-api:8080`.

### Azure

On Azure the app is plain static files, with no nginx. The browser calls the API's App Service directly.

1. Create a Static Web App on the **Free** plan, with **Other** as the deployment source.
2. Copy its token from **Manage deployment token**.
3. In Azure DevOps, create a pipeline from `frontend/azure-pipelines.yml`, and add a secret variable `SWA_DEPLOYMENT_TOKEN` with that token.
4. In the API's App Service, set `Cors__AllowedOrigins__0` to the app's origin, such as `https://polite-pebble-07b1ba510.5.azurestaticapps.net`. Leave off the trailing slash: CORS compares origins exactly, and a browser sends none.

The pipeline runs only when a file under `frontend/` changes on `main`. It builds with `npm run build:azure` and uploads `dist/product-catalog/browser`. `public/staticwebapp.config.json` serves `index.html` for every page address.

## Configuration

Nothing needs to be set for a local start. Change these when the API is somewhere else.

| Setting | Where | Default | Description |
| ------- | ----- | ------- | ----------- |
| `apiUrl` | `src/environments/environment.ts` | Empty | Prefix for API calls. Empty means `/api` on the server that serves the app: the dev proxy or nginx. |
| `apiUrl` | `src/environments/environment.azure.ts` | The live App Service URL | Used by `npm run build:azure`. Change it if the API moves. |
| `target` | `proxy.conf.json` | `http://localhost:5158` | Where `npm start` forwards `/api`. |
| `API_URL` | Container environment | `http://api:8080` | Where nginx forwards `/api`. Kubernetes sets `http://product-catalog-api:8080`. |
| `SWA_DEPLOYMENT_TOKEN` | Azure DevOps secret variable | Unset | The Static Web App's deployment token. The pipeline needs it. |
| `Cors__AllowedOrigins__0` | The API's App Service | Unset | The app's origin, so the browser may call the API. |
| `REFRESH_MS` | `src/app/product.service.ts` | `15000` | How often a page loads its data again. |

## Usage

Find products. The search box matches the name, the category, or the product number.

```
Search "optics"   → the products in the Optics category
Search "100005"   → Stage micrometer
Filters → Stock 0 to 5   → the API's stock-level query
```

Remove stock from a seed product. Product `100007`, LED illuminator, starts at stock `0`, so this shows the API's 409 message.

```
Open LED illuminator → quantity 1 → press −
```

Create a product. The API assigns the 6-digit id.

```
New product → fill in the form → Create product → the new product's page opens
```

## Pages

| Path | Page | Description |
| ---- | ---- | ----------- |
| `/products` | Product catalog | Search, filter, sort, and page the products. Tick rows to delete them, export them as CSV, or open one. |
| `/products/{id}` | Product | The stock line with − and +, the details form, and **Delete** in the ⋮ menu. |
| `/products/new` | New product | The empty form, with a starting stock. |
| Any other | | Redirects to `/products`. |

The pages use every endpoint in the [API reference](../backend/README.md#api-reference), including `GET /api/categories` for the form.

Form rules. They mirror the API's validation, so most mistakes are caught before a request:

- **Name:** required, at most 120 characters.
- **Description:** optional, at most 2000 characters.
- **Price (€):** above 0 and at most 1.000.000,00. Prices show as 2.450,00, and the field has a 0.000,00 mask that fills from the right, like a till.
- **Starting stock:** a whole number from 0 through 1,000,000. Only on New product. After that, stock changes only through − and +.
- **Category:** required.

### Behavior

- **Live search:** the search and filters run as you type. The price range, the statuses, sorting, and paging happen in the app, because the API has no such options.
- **Stock badges:** **Out of Stock** at 0, **Critical** from 1 to 3, **Low** from 4 to 9, and **In Stock** from 10.
- **Deletes:** every delete asks first in a dialog. Deleting ticked rows sends one request per product.
- **Unsaved changes:** a notice shows while the form differs from the saved product, and leaving then asks first.
- **Fresh data:** both pages load again every 15 seconds. If the API cannot be reached, a red ribbon offers **Try again**. Other errors show next to the action that caused them.

## Architecture

### Design

The app has two pages and a frame around them. A page asks `ProductService` for data, and the service calls the API over `HttpClient`, one method per endpoint. The page keeps the answer in signals. `computed()` derives what the table shows: the filtered, sorted, and paged rows, and the selection. Every 15 seconds, the page loads again.

Two small services connect the pages to the frame. `ApiStatus` turns on the red ribbon when the API cannot be reached. `Confirmation` opens the dialog and returns the user's answer.

```
Page → ProductService → HttpClient → /api → dev proxy, nginx, or App Service
  │
  ├─ signals and computed() → the template
  ├─ ApiStatus → ribbon in the frame
  └─ Confirmation → dialog in the frame
```

```
src/
  styles.scss             the whole design system
  environments/           the API address per build
  app/
    app.ts                the frame, the ribbon, and the dialog
    app.config.ts         providers, routes, and the leave guard
    product.service.ts    types, HTTP calls, stockStatus(), errorMessage(), ApiStatus, Confirmation
    product-list.ts       the Product catalog page, and productsCsv()
    product-detail.ts     the Product and New product page, and the price mask
public/
  zeiss-logo.svg, staticwebapp.config.json
```

### Requirements

The full-stack assessment adds an Angular frontend to the API, with these rules:

- **Use the API:** call its endpoints from the app.
- **Show the data:** a UI to view and work with products.
- **Show changes:** product data and stock levels changed through the API show in the UI.
- **Modern Angular:** the latest stable version, a clean structure, common best practices, and correct async handling.
- **Optional:** validation, filtering, and a UI framework.

### Decisions

- **Signals, no state library.** Two pages share little state, so NgRx would add ceremony without any benefit.
- **Few files.** Standalone components with inline templates, and no NgModules. Everything about a page is in one file.
- **Simple over efficient.** Every filter change loads the list again, and **Try again** reloads the page. A new load cancels one still waiting, so answers never arrive out of order.
- **The browser fills gaps in the API.** It handles price and status filters, sorting, paging, and a search combined with a stock range. **Room for improvement** says how to move this to the server.
- **Polling shows changes.** A reload every 15 seconds is the simplest way to show changes made elsewhere. Realtime push is an improvement.
- **One origin where possible.** Locally and in containers, `/api` goes through a proxy, so no CORS is needed. On Azure the browser calls App Service, which allows the app's origin.
- **Reactive forms mirror the API's rules.** **Unsaved changes** compares values, not keystrokes.
- **The platform first.** Confirmations use a native `<dialog>`, and closing the tab uses `beforeunload`.

### Design system

There is no UI library and no ready-made template. The app has a small design system of its own, so the work shows layout, positioning, and UX decisions rather than a library's look.

- **One file:** all styling is in `src/styles.scss`, CSS custom properties first, then a few plain classes. Components have no styles of their own.
- **ZEISS look:** colors and sizes follow the [ZEISS](https://www.zeiss.com) design tokens, light theme. The ZEISS typeface is proprietary, so text uses [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans).
- **One scale:** five type sizes from 12 to 20 px, spacing from 4 to 40 px, and 42 px fields and buttons, so every row lines up.
- **Color with a meaning:**
  - One blue marks what you can act on.
  - Red is only for errors, out of stock, and delete.
  - Orange is critical stock.
  - Every text color passes WCAG AA.
- **Quiet surfaces:** hairlines and whitespace instead of shadows. Fields copy the ZEISS sign-in page: white, with an underline.
- **Stock stands out:** a 20-graduation scale, like a stage micrometer, then the count and a colored badge.

### Responsiveness

The app works from phones to wide screens. Everything sits in one centered column, and rows wrap instead of overflowing. The table keeps stock in view: on phones it hides the less important columns, and only the table, never the page, scrolls sideways as a last resort.

On phones, fields use 16 px text, so Safari on iPhone does not zoom in when you tap them. The selection bar and the dialog shrink to fit the screen.

## Room for improvement

### Sign-in

Anyone who opens the app can change data, and the API accepts every call.

- Sign in with Microsoft Entra ID (`@azure/msal-angular`), and send the token from an HTTP interceptor.
- Guard the pages that change data, and hide actions the user's role does not allow.
- The API must still check the token, because Static Web Apps' sign-in protects only the static files.

### Accessibility

The app uses native elements, `aria` labels and states, keyboard focus rings, and WCAG AA colors, but it has not been audited.

- Make the ⋮, Status, and page size menus full ARIA menus, with arrow keys and focus handling.
- Move focus to the title when a page opens, and announce how many products match.
- Add a skip link, and show tooltips on touch screens.
- Test with axe or Lighthouse, and with VoiceOver and NVDA.

### Realtime updates instead of polling

Pages reload every 15 seconds, so changes appear late and every page keeps downloading the full list.

- Push changes from the API over SignalR, and update only the product that changed.
- Poll only while the connection is down.
- Let WebSockets through nginx and App Service.
- Add an ETag per product, so a stale save is refused instead of overwriting a newer one.

### Search, sorting, and paging on the server

The app downloads every matching product, and sends a request on every keystroke. That works for 8 products, not for thousands.

- Add one paged list endpoint that takes the search, filters, and sort, such as `GET /api/products?name=stemi&sort=price&page=1`, and returns the items and the total.
- Wait for a pause in typing (`debounceTime(300)`) before searching.
- Add a bulk delete, so the selection bar sends one request.

## Contributing

1. Branch from the default branch. Use `feature/<short-name>` for a change and `fix/<short-name>` for a defect.
2. Keep the change limited to that branch name.
3. Run the tests and the build from the `frontend` folder:

```bash
npm test
npm run build
```

The unit tests run with Vitest and Angular's TestBed, against a fake `ProductService`, so they need no running API:

- `product.service.spec.ts` checks the URL and method of every API call, the error messages, the stock badges, and the confirmation dialog.
- `product-list.spec.ts` covers search, filters, sorting, paging, the row menu, the selection bar, CSV export, and the API ribbon.
- `product-detail.spec.ts` covers loading, stock changes, saving, the price mask, unsaved changes, leaving, and delete.

4. Open a pull request into the default branch. Describe the behavior change and the test result.

Keep all styling in `src/styles.scss`.
