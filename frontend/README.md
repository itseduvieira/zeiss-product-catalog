# Product Catalog frontend

Angular app for the [Product Catalog API](../backend/README.md). It lists products with their stock, and lets you create, edit, and delete them, change stock, search by name, and filter by stock range.

## Prerequisites

- Node.js `^22.22.3`, `^24.15.0`, or `>=26`, with npm.
- The API running on `http://localhost:5158`. From the `backend` folder: `dotnet run --project src/ProductCatalog.Api`.

## Run

From the `frontend` folder:

```bash
npm install
npm start
```

Open [http://localhost:4200](http://localhost:4200). The dev server forwards every `/api` request to `http://localhost:5158`, as set in `proxy.conf.json`. The browser sees one origin, so the API needs no CORS setup. If the API runs on another port, change `target` in that file.

## Test and build

```bash
npm test
npm run build
```

`npm test` runs the unit tests once with Vitest. `npm run build` writes the production build to `dist/`.

The app sends API calls to `apiUrl` in `src/environments/environment.ts`. It is empty, so calls go to `/api` on the server that serves the app: the dev proxy, or nginx in Docker and Kubernetes. `npm run build:azure` swaps in `environment.azure.ts`, which holds the full App Service URL.

## Docker and Kubernetes

The image builds the app and serves it with nginx. nginx also forwards every `/api` request to the API, so the browser still talks to one origin and the API needs no CORS setup. The API address is the `API_URL` environment variable, `http://api:8080` by default.

With Docker Compose, from the `frontend` folder. It also starts the API, through `../backend/docker-compose.yml`:

```bash
docker compose up --build
```

The app is at [http://localhost:4200](http://localhost:4200), and the API is still at `http://localhost:5158`. The compose project is named after this folder, so the database lives in the `frontend_catalog-data` volume. `docker compose down -v` deletes it.

On a local Kubernetes cluster, start the API first, because nginx looks up its address when it starts:

```bash
docker compose build
kubectl apply -f ../deploy/k8s/backend
kubectl apply -f ../deploy/k8s/frontend
kubectl port-forward svc/product-catalog-web 4200:8080
```

`docker compose build` builds both images, `product-catalog-api:local` and `product-catalog-web:local`. The web Deployment runs one replica and sets `API_URL` to the API Service, `http://product-catalog-api:8080`.

## Azure

On Azure the app is static files on **Azure Static Web Apps**, without nginx. The browser calls the API on its App Service directly, so the API allows the Static Web App's address through CORS.

`azure-pipelines.yml` installs, tests, builds with `npm run build:azure`, and uploads `dist/product-catalog/browser` to the Static Web App. It runs only when a file under `frontend/` changes on `main`.

To set it up:

1. In the Azure portal, create a Static Web App on the **Free** plan. For the deployment source, pick **Other**, because Azure DevOps deploys it.
2. In the Static Web App, open **Manage deployment token** and copy the token.
3. In Azure DevOps, create a pipeline from `frontend/azure-pipelines.yml`. Add a secret variable named `SWA_DEPLOYMENT_TOKEN` with that token.
4. In the API's App Service, add the application setting `Cors__AllowedOrigins__0` with the Static Web App URL, for example `https://<name>.azurestaticapps.net`.

If the API moves to another address, change `apiUrl` in `src/environments/environment.azure.ts`.

`public/staticwebapp.config.json` serves `index.html` for every page address, so a link such as `/products/100001` opens the right screen. nginx does the same in Docker and Kubernetes.

## How it works

The app has two screens inside one frame: a header with the **Zeiss Vision** name, the screen, and a footer.

- **Product catalog** (`/products`) is the master screen. It has separate sections, top to bottom: a dark icon tile, the title, and a muted subtitle, with, on the right, **Export** and **New product**; the filters (**Name**, **Min stock**, and **Max stock**); the table of products, with a checkbox column and then name, category, price, and stock; and a footer with the total, the page numbers, and **Show per page**. The **Name**, **Category**, and **Price** column headings sort the table. A click anywhere on a row, except its checkbox, opens that product's screen. Product names are bold, and are also links for the keyboard and screen readers.
- **Product** (`/products/{id}`) is the detail screen. It shows the product's number, category, and price, changes its stock, edits its details, and deletes it. `/products/new` is the same screen with an empty form.

Each API endpoint maps to one control:


| Endpoint                                              | Control                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| `GET /api/products`                                   | The Product catalog table, when the search boxes are empty. |
| `GET /api/products/search?name={name}`                | Typing in the **Name** filter.                             |
| `GET /api/products/stock-level?min={min}&max={max}`   | Typing in **Min stock** or **Max stock**.                  |
| `GET /api/products/{id}`                              | Opening a product's screen.                                |
| `POST /api/products/{id}/add-to-stock/{quantity}`     | **Add** on a product's screen, with the quantity box.      |
| `POST /api/products/{id}/decrement-stock/{quantity}`  | **Remove** on a product's screen.                          |
| `PUT /api/products/{id}`                              | **Save changes** on a product's screen.                    |
| `DELETE /api/products/{id}`                           | **Delete product** on a product's screen, or **Delete** in the selection bar for each ticked product, after a confirmation. |
| `POST /api/products`                                  | **Create product** on the New product screen. **New product** above the table opens it. |
| `GET /api/categories`                                 | The category list in the form.                             |


Behavior to know:

- The search runs by itself 300 ms after you stop typing. There is no search button. Empty boxes list every product.
- With only **Min stock** or only **Max stock**, the other end of the range is 0 or the API's maximum of 1,000,000. With a name and a range together, the app asks for the range and keeps the names that match, because the API has no query for both.
- A click on the **Name**, **Category**, or **Price** heading sorts by that column, and a second click reverses the order. An arrow marks the sorted column. The table starts sorted by name. Sorting happens in the app, because the API returns a fixed order, and it applies to whatever the filters return. On phones the Category column is hidden, so the table cannot be sorted by category there.
- Ticking a row's checkbox shows a dark bar at the bottom of the screen, above the footer, with the number of ticked products, **Delete**, and a close button that clears the ticks. **Delete** asks first, then sends one delete request per product, because the API has no bulk delete. The count and the actions cover only ticked products that the filters still show, so a filter never hides what would be deleted.
- **Export** downloads `products.csv` with the ticked products, or, with none ticked, the products that match the filters, in the table's order and from every page. Its columns are Product number, Name, Category, Price (EUR), and Stock. The file starts with a byte order mark so Excel reads it as UTF-8.
- The table shows 10 products a page by default, and **Show per page** switches between 5, 10, and 20. Paging happens in the app, because the API returns the whole list. A new search, sort, or page size goes back to page 1.
- Both screens ask the API again every 15 seconds, so changes made elsewhere appear without a reload. The interval is `REFRESH_MS` in `product.service.ts`. The product form follows those updates until you type in it.
- Stock changes only through **Add** and **Remove**. **Save changes** keeps the stock the API holds.
- The form checks the same rules as the API. If the API still rejects an action, its message shows next to that action.

## Design

The app is a tool for checking and changing the stock of optics products, so the design keeps that one number easy to read and everything else quiet. All styling is in `src/styles.scss`: the tokens come first, then the classes below. Components have no styles of their own.

The header shows the ZEISS logo, `public/zeiss-logo.svg`, at 40 px before the app name. The colors and font sizes follow the ZEISS design tokens published on [zeiss.com](https://www.zeiss.com), light theme. The typeface does not: ZEISS uses its own fonts, so the app uses Instrument Sans.

### Principles

- **One blue.** Blue marks what you can act on: links, the main button, and filled stock. It comes in the ZEISS shades: a bright fill, a darker shade for link text, a hover shade, and a focus shade. Nothing else is blue.
- **Red means a problem.** It is used only for out of stock, errors, and delete.
- **Lines and space, not shadows.** Hairline borders and whitespace separate content. Surfaces are flat.
- **One column.** Header, screen, and footer share a left-aligned column 60rem wide.
- **Stock is the one memorable element.** It is drawn as a graduated scale. The rest of the interface stays plain.

### Color

| Token       | Value     | ZEISS token                | Use                                          | Contrast on white |
| ----------- | --------- | -------------------------- | -------------------------------------------- | ----------------- |
| `--paper`   | `#f5f8fa` | `background-01`            | Page background                              |                   |
| `--surface` | `#ffffff` | `background-primary`       | Header, footer, cards, inputs                |                   |
| `--ink`     | `#32373e` | `text-strong`              | Text, the selected filter                    | 12.0:1            |
| `--muted`   | `#606a76` | `text-subtle`              | Secondary text, table headings, fact labels  | 5.5:1             |
| `--line`    | `#c2cdd6` | `border-subtle`            | Borders, the empty part of the stock scale   |                   |
| `--accent`  | `#0072ef` | `background-interactive`   | The main button, the filled stock scale      | 4.5:1             |
| `--link`    | `#0065d1` | `text-interactive`         | Link text                                    | 5.6:1             |
| `--hover`   | `#0052aa` | `background-hover`         | Links and the main button under the pointer  | 7.5:1             |
| `--focus`   | `#00346c` | `border-focus`             | Focus: the ring on buttons and links, the underline of a field | 12.3:1 |
| `--danger`  | `#b21212` | `text-error`               | Errors, out of stock, delete                 | 7.0:1             |
| `--field-focus` | `#ecf0f4` | sign-in page focus fill  | The fill of a field you are typing in        |                   |
| `--field-error` | `#fe7a7a33` | sign-in page error fill | The red tint of a field with a wrong value  |                   |
| `--row-hover` | `#ecf0f4` | `list-background-hover` | A table row under the pointer              |                   |
| `--line-on-ink` | `#4e565f` | dark theme `border-subtle` | Borders and dividers on `--ink`, such as in the selection bar |   |

Every text color passes WCAG AA, which asks for 4.5:1, on both `--surface` and `--paper`. `--accent` is used only as a fill: white text on it measures 4.5:1, which just passes. Link text uses the darker `--link`, because `--accent` drops to 4.2:1 on `--paper`.

### Typography

One family, [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans), loaded in `src/index.html`. Body text is weight 400. Labels, buttons, and table headings are 500. Headings are 600.

| Token       | Size  | Line height | Use                                              |
| ----------- | ----- | ----------- | ------------------------------------------------ |
| `--text-xl` | 20 px | 24 px       | Screen title (`h1`)                              |
| `--text-lg` | 18 px | 1.4         | Section title (`h2`), the app name, stock reading |
| `--text-md` | 16 px | 1.5         | Body text, inputs                                |
| `--text-sm` | 14 px |             | Labels, table headings, buttons, messages        |
| `--text-xs` | 12 px | 16 px       | The subtitle under a screen title                |

All five sizes are on the ZEISS type scale. The title and subtitle lines add up to 40 px, so with 2 px between them they fill the 42 px of a button, and a screen's header row lines up.

Tables, product facts, and the stock reading use tabular figures, so digits line up in columns.

### Space and shape

| Token       | Value  | Typical use                                  |
| ----------- | ------ | -------------------------------------------- |
| `--space-1` | 4 px   | Label to input                               |
| `--space-2` | 8 px   | Between buttons in a row                     |
| `--space-3` | 16 px  | Between fields and paragraphs, phone margins |
| `--space-4` | 24 px  | Panel padding, below a toolbar               |
| `--space-5` | 40 px  | Between sections, page top and bottom        |
| `--radius`  | 3 px   | Buttons. Fields are square.                  |
| `--radius-card` | 12 px | Cards. Containers are rounder than the controls inside them. |
| `--field`   | 42 px  | Height of every field and button             |
| `--page`    | 60 rem | Width of the content column                  |

### Fields

Inputs, selects, and text areas follow the fields on the ZEISS sign-in page: a white field with a 1px `--line` underline and no box. They are not styled with a class; the rules apply to the elements themselves.

| State                     | What changes                                                        |
| ------------------------- | ------------------------------------------------------------------- |
| Hover                     | The underline turns `--ink`.                                        |
| Focus                     | The field fills with `--field-focus` and the underline turns `--focus`, the ZEISS focus color. There is no outline ring. |
| Wrong value, after leaving the field | The underline turns `--danger` and the field fills with `--field-error`. The message below says what to enter. Angular's `ng-invalid` and `ng-touched` classes switch this on. |

Two things differ from the sign-in page on purpose. Typed text is 16 px, not 12 px, because Safari on iPhone zooms the page into any field with smaller text. Labels sit above the field at 14 px, instead of floating inside it at 9 px, so they stay readable on a five-field form.

### Classes

| Class                           | What it is                                                              |
| ------------------------------- | ----------------------------------------------------------------------- |
| `.bar`                          | Header and footer: a white strip on the content column.                 |
| `.page`                         | The screen area between them: a column that fills the window's height. The routed screen lays its parts out directly in it, so the selection bar can sit at its bottom. |
| `.row`                          | Items in a wrapping line, all as tall as the tallest.                   |
| `.page-header`                  | The top of a screen: the title on the left, the screen's buttons on the right, centered on one line. |
| `.title`, `.subtitle`           | The title and its muted 12 px subtitle, stacked in a block exactly as tall as a button. |
| `.icon-tile`                    | A 42 px dark square with a white 20 px icon, placed before a title. Its icon is decorative and hidden from screen readers. |
| `.toolbar`                      | The filters above a table: labelled fields packed to the left and lined up along their bottom edge. |
| `.table-footer`                 | Under a table, after a line: the total, the page numbers, and the page size. |
| `.grow`                         | Takes the free width in its strip or row, such as the Name filter.      |
| `.crumbs`                       | The link back to the Product catalog.                                   |
| `button`, `.button`             | Outlined button, as tall as a field. An icon goes before the text, 16 px, drawn with `currentColor`, such as on **Export**. `.button` makes a link look like one. |
| `.sort`                         | A column heading that sorts the table. It looks like the heading text, and an arrow follows it when the `th` has `aria-sort`. |
| `.primary`                      | The main action, filled with `--accent`, such as **Save changes**.      |
| `.danger`                       | A destructive action, in red text.                                      |
| `.field`                        | A label, its input, and its error message, stacked.                     |
| `.short`                        | A narrow number box, such as a quantity or a stock limit.               |
| `.card`                         | A section of a screen: a rounded white card with a border and padding, such as Stock and Details on a product's screen. |
| `.table-scroll`                 | Holds a table, which scrolls sideways inside its card when it is too wide. |
| `.pages`                        | The page numbers under a table. The current page has `aria-current="page"` and is marked in blue. |
| `.number`                       | Right-aligns a table column.                                            |
| `.nowrap`                       | A cell that stays on one line, such as stock. On phones it may wrap, so the table fits. |
| `.check`                        | The checkbox column, as narrow as its checkbox. Its header is empty. Checkboxes keep their native look in `--accent`, with a white-on-dark focus ring. |
| `.clickable`                    | A table row that opens something when clicked anywhere: a pointer cursor and `--row-hover` under the pointer. |
| `.name`                         | A product name in a row: bold `--ink` text that is still a link, underlined under the pointer. |
| `.selection-bar`                | Actions for ticked rows: a dark bar 456 px wide and 52 px tall, with 32 px buttons and a semibold count. The count is on the left; a red **Delete**, a 28 px divider, and a close button are on the right. It sticks to the bottom of the window while the page scrolls and stops above the footer, so it never covers the footer or the page numbers. Its focus ring is white, because `--focus` would not show on `--ink`. |
| `.wide`                         | A column hidden on phones, so stock stays in view.                      |
| `.facts`                        | A product's facts as a grid of label and value.                         |
| `.scale`, `.scale.large`        | The stock scale. See below.                                             |
| `.reading`                      | The stock figure above the large scale.                                 |
| `.muted`, `.error`, `.message`  | Secondary text, red text, and the result of an action.                  |

### Stock scale

Stock is drawn as 20 graduations, like the scale on a stage micrometer. Filled graduations are `--accent`, and empty ones are `--line`. Set `--level` to the number of graduations to fill, from 0 to 20:

```html
<span class="scale" style="--level: 6"></span>
```

In the screens, `[style.--level]="scaleLevel(product.stock)"` fills it. `scaleLevel()` in `product.service.ts` caps the value at 20, so stock of 20 or more fills the scale. The list uses the small scale next to the number. The product screen uses `.scale.large` across the Stock card. At zero the scale is empty and the text says **Out of stock** in red.

### Phones and access

- Below 40rem, table cells get tighter, `.wide` columns are hidden, and the stock cell may wrap, so the table fits the screen.
- Buttons and links get a 2px `--focus` outline when focused from the keyboard. Fields show focus with their fill and a `--focus` underline instead.
- Nothing moves on its own. There are no animations to turn off for reduced motion.
- Color is never the only signal: out of stock is also written out, and errors are text.

## Layout

```
public/
  zeiss-logo.svg             the ZEISS logo in the header
  staticwebapp.config.json   page addresses on Azure Static Web Apps
src/
  styles.scss                the design system
  environments/              the API address per build
  app/
    app.ts                   the frame: header, screen, footer
    app.config.ts            providers and routes
    product.service.ts       types, HTTP calls (one method per endpoint), errorMessage()
    product-list.ts          the Products screen
    product-detail.ts        the Product and New product screen
```

## Room for improvement

### Sign-in

Anyone who can open the app can create, edit, and delete products and change stock. There is no sign-in screen, and the API accepts every call (see **Room for improvement** in the [backend README](../backend/README.md)).

- Add a sign-in page and a **Sign out** link in the header. With Microsoft Entra ID, `@azure/msal-angular` signs the user in and gets an access token for the API.
- Send that token with every API call from an HTTP interceptor (`withInterceptors` in `provideHttpClient`). On a 401, send the user back to sign-in.
- Protect the screens that change data, such as `/products/new`, with a route guard (`CanActivateFn`). Hide the actions the user's role does not allow, such as **Delete product**.
- Static Web Apps has built-in sign-in, with Microsoft Entra ID and GitHub on the Free plan. It protects the static files only. The API runs on App Service, on another address, so the API must still check the token itself.

### Live updates across clients

Each open screen asks the API again every 15 seconds (`REFRESH_MS`). A change made in another browser takes up to 15 seconds to appear. Every open screen sends 4 requests a minute even when nothing changed, and the list request returns every product each time.

- Keep a two-way connection open instead. The API pushes a message such as "product 100001 changed" over SignalR, which uses WebSockets, and each screen updates only that product. The browser client is `@microsoft/signalr`. The server side is in the backend README.
- Keep the 15-second refresh as a fallback while the connection is down.
- In Docker and Kubernetes, nginx must pass the WebSocket upgrade through on the SignalR path: `proxy_http_version 1.1` and the `Upgrade` and `Connection` headers.
- Warn about conflicting edits. If two people edit the same product, the last **Save changes** wins without a warning. With a version on each product, sent as an ETag by the API, the form can say that the product changed since it was opened and offer to reload it.

### Search, sorting, and paging on the backend

The API has one endpoint for a name search and another for a stock range, and neither sorts or pages. So part of the work happens in the browser today:

- A name and a stock range together: the app asks for the whole range and keeps the matching names itself.
- Sorting by name, category, or price, and splitting the result into pages, happen in the app on the full list.
- Every search and every 15-second refresh downloads every matching product, even when the table shows 10.

That works for the 8 seed products. With thousands it would be slow, and the total and the page numbers would only be right because the whole list was downloaded.

- Add one list endpoint that takes every option as a query parameter, for example `GET /api/products?name=stemi&minStock=1&maxStock=20&sort=price&order=desc&page=1&pageSize=10`. It should return one page and the total, such as `{ "items": [...], "total": 42 }`.
- Let the database do the work. EF Core turns `Where`, `OrderBy`, `Skip`, and `Take` into one SQL query, so only one page leaves the database.
- In the app, send the filters, sort, and page as those parameters, keep the 300 ms wait while typing, and take the total for the footer from the response. The sorting, combined filtering, and paging code in `product-list.ts` then goes away.
- Keep `GET /api/products/search` and `GET /api/products/stock-level`. The assessment asks for them.
- Add a bulk delete, such as `POST /api/products/delete` with a list of ids, so the selection bar sends one request instead of one per product, and the deletes succeed or fail together.
