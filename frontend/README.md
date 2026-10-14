# Product Catalog frontend

Angular app for the [Product Catalog API](../backend/README.md). It lists products with their stock, and lets you create, edit, and delete them, change stock, search by name, and filter by stock range.

The live app is at [https://polite-pebble-07b1ba510.5.azurestaticapps.net/](https://polite-pebble-07b1ba510.5.azurestaticapps.net/), on Azure Static Web Apps. See **Azure** below.

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

On Azure the app is static files on **Azure Static Web Apps**, without nginx. It is live at [https://polite-pebble-07b1ba510.5.azurestaticapps.net/](https://polite-pebble-07b1ba510.5.azurestaticapps.net/). The browser calls the API on its App Service directly, so the API allows the Static Web App's address through CORS.

`azure-pipelines.yml` installs, tests, builds with `npm run build:azure`, and uploads `dist/product-catalog/browser` to the Static Web App. It runs only when a file under `frontend/` changes on `main`.

To set it up:

1. In the Azure portal, create a Static Web App on the **Free** plan. For the deployment source, pick **Other**, because Azure DevOps deploys it.
2. In the Static Web App, open **Manage deployment token** and copy the token.
3. In Azure DevOps, create a pipeline from `frontend/azure-pipelines.yml`. Add a secret variable named `SWA_DEPLOYMENT_TOKEN` with that token.
4. In the API's App Service, add the application setting `Cors__AllowedOrigins__0` with the Static Web App's origin. For the live app that is `https://polite-pebble-07b1ba510.5.azurestaticapps.net`, with no trailing slash: a browser sends the origin without one, and CORS compares the two exactly.

If the API moves to another address, change `apiUrl` in `src/environments/environment.azure.ts`.

`public/staticwebapp.config.json` serves `index.html` for every page address, so a link such as `/products/100001` opens the right screen. nginx does the same in Docker and Kubernetes.

## How it works

The app has two screens inside one frame: a header with the **Zeiss Vision** name, the screen, and a footer.

- **Product catalog** (`/products`) is the master screen. It has separate sections, top to bottom: a dark icon tile, the title, and a muted subtitle, with, on the right, an export icon button and **New product**; a search box with a magnifier that runs the width of the table and matches the name, ID, or category, with a **Filters** button at its right end; a row of more filters under it, shown while **Filters** is pressed, in three labelled groups: **Status**, a dropdown with a checkbox per stock badge, then **Stock** and **Price (€)**, each with a Min and a Max box, and a **Clear filters** link while any of them is set; the table of products, with a checkbox column and then product number (ID), name, category, price, and stock, where stock is the stock scale, the count, and a badge: **In Stock**, **Low**, **Critical**, or **Out of Stock**, and a last column with a ⋮ button that opens the row's menu with **Delete**; and a small footer with ‹ and › page arrows and the range shown, such as "1–8 of 8 products". The **Name**, **Category**, and **Price (€)** column headings sort the table. A click anywhere on a row, except its checkbox and its ⋮ menu, opens that product's screen. Product names are bold, and are also links for the keyboard and screen readers.
- **Product** (`/products/{id}`) is the detail screen, laid out like the master screen. Its header sits where the list's does, with the same icon tile, the product name as the title, and its product number as the muted subtitle, with a ⋮ button on the right that opens a menu with **Delete**, like the one on each row of the list. Then come two sections: **Stock**, one line with the stock scale, the count, and its badge, then small − and + icon buttons, **Remove from stock** and **Add to stock**, around a quantity box; and **Details**, the form with **Save changes** (a check icon) and **Cancel** (an × icon), which goes back to the list without saving. `/products/new` is the same screen with the title **New product**, no Stock section or ⋮ menu, a **Starting stock** box, and **Create product** with a plus icon.

Each API endpoint maps to one control:


| Endpoint                                              | Control                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| `GET /api/products`                                   | The Product catalog table, when the search boxes are empty. |
| `GET /api/products/search?name={name}`                | Typing in **Search by name, ID or category**. The API matches the name, the category, or the product number. |
| `GET /api/products/stock-level?min={min}&max={max}`   | Typing in **Min stock** or **Max stock**, behind **Filters**, while the search box is empty. |
| `GET /api/products/{id}`                              | Opening a product's screen.                                |
| `POST /api/products/{id}/add-to-stock/{quantity}`     | + (**Add to stock**) on a product's screen, with the quantity box. |
| `POST /api/products/{id}/decrement-stock/{quantity}`  | − (**Remove from stock**) on a product's screen.           |
| `PUT /api/products/{id}`                              | **Save changes** on a product's screen.                    |
| `DELETE /api/products/{id}`                           | **Delete** in a row's ⋮ menu, **Delete** in the ⋮ menu in a product's header, or **Delete** in the selection bar for each ticked product, after the delete dialog. |
| `POST /api/products`                                  | **Create product** on the New product screen. **New product** above the table opens it. |
| `GET /api/categories`                                 | The category list in the form, loaded again with the product. |


Behavior to know:

- The search runs as you type. There is no search button. Every change to the search or a filter asks the API again and goes back to page 1. Empty boxes list every product.
- The search box has no label on screen, only a placeholder. In the Filters row, each group has a heading, and its boxes say Min and Max. Screen readers get each box's full name, such as "Min stock", from its `aria-label`. While any filter behind **Filters** is set, the button shows how many, so a closed row never hides an active filter.
- Every price is labelled **Price (€)**: the column heading, the filter group, the form field, and the CSV column. Because the label carries the €, the table and the form show a price as a plain amount with two decimals, such as 2,450.00.
- The form's price box has a 0,000.00 mask. It reads the digits typed so far as cents, like a till: typing 2 4 5 0 0 0 shows 0.02, 0.24, 2.45, 24.50, 245.00, then 2,450.00, and Backspace takes the last digit off again. Anything but digits is dropped. It is a text box with a number keyboard on phones, and `maskPrice()` in `product-detail.ts` does the formatting.
- **Min price** and **Max price** filter in the app, because the API has no price filter. Like any other filter, a change still loads the list again, so every filter follows the same rule.
- The stock badge follows the count: **Out of Stock** at 0, **Critical** from 1 to 3, **Low** from 4 to 9, and **In Stock** from 10. The limits are in `stockStatus()` in `product.service.ts`.
- **Clear filters** at the end of the Filters row clears Status, Stock, and Price (€) at once. It shows only while one of them is set, and leaves the search text as it is.
- The **Status** dropdown in the Filters row opens a menu with a checkbox and a badge for each stock status, and shows only the products with the ticked badges. Closed, it reads **All**, the one ticked status, or how many are ticked. It closes on a click outside it or on Escape, filters in the app, and counts as one filter on the **Filters** button, however many statuses are ticked.
- With only **Min stock** or only **Max stock**, the other end of the range is 0 or the API's maximum of 1,000,000. With search text and a range together, the app runs the search and keeps the products in the range, because the API has no query for both.
- A click on the **Name**, **Category**, or **Price (€)** heading sorts by that column, and a second click reverses the order. An arrow marks the sorted column. Until a heading is clicked, the table keeps the order the API sends: by product number, or by stock for a stock range alone. Sorting happens in the app, because the API returns a fixed order, and it applies to whatever the filters return. On phones the Category column is hidden, so the table cannot be sorted by category there.
- Ticking a row's checkbox shows a dark bar at the bottom of the screen, above the footer, with the number of ticked products, **Delete**, and a close button that clears the ticks. **Delete** asks first, then sends one delete request per product, because the API has no bulk delete. Ticks on other rows stay. The count and the actions cover only ticked products that the filters still show, so a filter never hides what would be deleted.
- The export button, an icon with an **Export as CSV** tooltip, downloads `products.csv` with every product that matches the filters, in the table's order and from every page. Ticked rows make no difference. Its columns are Product number, Name, Category, Price (€), and Stock, and every value is in quotes. The file starts with a byte order mark so Excel reads it as UTF-8.
- The table shows 10 products a page by default, and a click on the range opens a **Products per page** menu with 5, 10, and 20. The menu closes on a choice, on a click outside it, or on Escape. Paging happens in the app, because the API returns the whole list. A new search, sort, or page size goes back to page 1.
- Both screens ask the API again every 15 seconds, so changes made elsewhere appear without a reload. The interval is `REFRESH_MS` in `product.service.ts`. The product form follows those updates until you type in it.
- Stock changes only through − and +. **Save changes** keeps the stock the API holds.
- Every delete asks first in a dialog in the middle of the screen: **Delete "Primo Star"?** or **Delete 2 products?**, with **Cancel** and a red **Delete**. **Cancel** has the focus, and Escape also cancels. It is a native `<dialog>` opened with `showModal()`, so the page behind it is dimmed and cannot be used. The screens ask through `Confirmation` (`askToDelete()` and `askToLeave()`) and wait for the answer; the frame in `app.ts` shows the dialog.
- While the product form has changes that are not saved, **Unsaved changes** shows next to **Cancel**, after a small `--warn` dot. It compares the form with the saved product, not with what was typed: change a value back to what it was and the notice goes away, and leaving no longer asks. Saving also clears it. Typing also clears the last "Changes saved" message.
- Leaving a product screen with unsaved changes asks first, in the same dialog: **Leave without saving?**, "Your changes will be lost", with **Cancel** to stay and a red **Leave**. A `canDeactivate` guard in `app.config.ts` asks the screen's `canLeave()`, so this covers **Cancel**, the header link, and the browser's back button. Reloading or closing the tab asks too, through the browser's own `beforeunload` prompt, whose words the browser picks. Creating or deleting the product does not ask, because nothing is left to save.
- The form checks the same rules as the API. If the API still rejects an action, its message shows next to that action.
- When the API cannot be reached at all, a thin red ribbon runs under the header, end to end, with "The API is not reachable" and **Try again** in the middle. **Try again** is an underlined link that reloads the page. The ribbon goes away after the next successful load, which also happens on its own every 15 seconds. Other errors, such as a missing product or a wrong value, still show next to what caused them.

## Design

The app is a tool for checking and changing the stock of optics products, so the design keeps that one number easy to read and everything else quiet. All styling is in `src/styles.scss`: the tokens come first, then the classes below. Components have no styles of their own.

The header shows the ZEISS logo, `public/zeiss-logo.svg`, at 40 px before the app name. The colors and font sizes follow the ZEISS design tokens published on [zeiss.com](https://www.zeiss.com), light theme. The typeface does not: ZEISS uses its own fonts, so the app uses Instrument Sans.

### Principles

- **One blue.** Blue marks what you can act on: links, the main button, and filled stock. It comes in the ZEISS shades: a bright fill, a darker shade for link text, a hover shade, and a focus shade. Nothing else is blue.
- **Red means a problem.** It is used only for out of stock, errors, and delete. Critical stock is orange, one step below.
- **Lines and space, not shadows.** Hairline borders and whitespace separate content. Surfaces are flat.
- **One column.** Header, screen, and footer share a left-aligned column 60rem wide.
- **Stock is the one memorable element.** It is drawn as a graduated scale, followed by the count and a colored badge, in the table and on a product's screen. The rest of the interface stays plain.
- **No closing periods in the interface.** Messages, hints, field errors, and the subtitle end without a period, such as "Changes saved". Text that comes from the API is shown as the API sends it.

### Color

| Token       | Value     | ZEISS token                | Use                                          | Contrast on white |
| ----------- | --------- | -------------------------- | -------------------------------------------- | ----------------- |
| `--paper`   | `#f5f8fa` | `background-01`            | Page background                              |                   |
| `--surface` | `#ffffff` | `background-primary`       | Header, footer, menus, inputs                |                   |
| `--ink`     | `#32373e` | `text-strong`              | Text, table headings                         | 12.0:1            |
| `--muted`   | `#606a76` | `text-subtle`              | Secondary text, product numbers, fact labels | 5.5:1             |
| `--line`    | `#c2cdd6` | `border-subtle`            | Borders, the empty part of the stock scale   |                   |
| `--accent`  | `#0072ef` | `background-interactive`   | The main button, the filled stock scale      | 4.5:1             |
| `--link`    | `#0065d1` | `text-interactive`         | Link text                                    | 5.6:1             |
| `--hover`   | `#0052aa` | `background-hover`         | Links and the main button under the pointer  | 7.5:1             |
| `--focus`   | `#00346c` | `border-focus`             | Focus: the ring on buttons and links, the underline of a field | 12.3:1 |
| `--danger`  | `#b21212` | `text-error`               | Errors, out of stock, delete                 | 7.0:1             |
| `--ok`, `--ok-fill` | `#166249` on `#e5f9f3` | `text-success`, `background-success_subtle` | The **In Stock** badge | 6.7:1 |
| `--warn`, `--warn-fill` | `#725400` on `#fff4d5` | `text-caution`, `background-caution_subtle` | The **Low** badge | 6.4:1 |
| `--critical` | `#cd4b13` | `badge-background-orange` | The **Critical** badge, with white text | 4.55:1 for white on it |
| `--field-focus` | `#ecf0f4` | sign-in page focus fill  | The fill of a field you are typing in        |                   |
| `--field-error` | `#fe7a7a33` | sign-in page error fill | The red tint of a field with a wrong value  |                   |
| `--row-hover` | `#ecf0f4` | `list-background-hover` | A table row under the pointer              |                   |
| `--header-fill` | `#e6ebf0` | `background-04` | The header row of a table, under `--ink` text | 10.0:1 for `--ink` on it |
| `--selected-fill` | `#eaf7ff` | `information-10` | A selected button, such as **Filters** while its row is open, with `--link` text | 5.1:1 for `--link` on it |
| `--line-on-ink` | `#4e565f` | dark theme `border-subtle` | Borders and dividers on `--ink`, such as in the selection bar |   |

Every text color passes WCAG AA, which asks for 4.5:1, on both `--surface` and `--paper`. `--accent` is used only as a fill: white text on it measures 4.5:1, which just passes. Link text uses the darker `--link`, because `--accent` drops to 4.2:1 on `--paper`.

### Typography

One family, [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans), loaded in `src/index.html`. Body text is weight 400. Labels, buttons, and table headings are 500. Headings are 600.

| Token       | Size  | Line height | Use                                              |
| ----------- | ----- | ----------- | ------------------------------------------------ |
| `--text-xl` | 20 px | 24 px       | Screen title (`h1`)                              |
| `--text-lg` | 18 px | 1.4         | Section title (`h2`), the app name, stock reading |
| `--text-md` | 16 px | 1.5         | Body text, and the text in fields on phones      |
| `--text-sm` | 14 px |             | The text in fields, table headings, buttons, messages |
| `--text-xs` | 12 px | 16 px       | The subtitle under a screen title, field labels  |

All five sizes are on the ZEISS type scale. The title and subtitle lines add up to 40 px, so with 2 px between them they fill the 42 px of a button, and a screen's header row lines up.

Tables and the stock reading use tabular figures, so digits line up in columns.

### Space and shape

| Token       | Value  | Typical use                                  |
| ----------- | ------ | -------------------------------------------- |
| `--space-1` | 4 px   | Label to input                               |
| `--space-2` | 8 px   | Between buttons in a row                     |
| `--space-3` | 16 px  | Between fields and paragraphs, phone margins |
| `--space-4` | 24 px  | Panel padding, below a toolbar               |
| `--space-5` | 40 px  | Between sections, page top and bottom        |
| `--radius`  | 3 px   | Buttons. Fields are square.                  |
| `--radius-container` | 12 px | Menus and the selection bar. Containers are rounder than the controls inside them. |
| `--field`   | 42 px  | Height of every field and button             |
| `--page`    | 60 rem | Width of the content column                  |

### Fields

Inputs, selects, and text areas follow the fields on the ZEISS sign-in page: a white field with a 1px `--line` underline and no box. They are not styled with a class; the rules apply to the elements themselves.

| State                     | What changes                                                        |
| ------------------------- | ------------------------------------------------------------------- |
| Hover                     | The underline turns `--ink`.                                        |
| Focus                     | The field fills with `--field-focus` and the underline turns `--focus`, the ZEISS focus color. There is no outline ring. |
| Wrong value, after leaving the field | The underline turns `--danger` and the field fills with `--field-error`. The message below says what to enter. Angular's `ng-invalid` and `ng-touched` classes switch this on. |

Two things differ from the sign-in page on purpose. Typed text is 14 px, not 12 px, and 16 px on phones, because Safari on iPhone zooms the page into any field with smaller text. Labels sit above the field at 12 px, instead of floating inside it at 9 px, so they stay readable on a five-field form.

### Classes

| Class                           | What it is                                                              |
| ------------------------------- | ----------------------------------------------------------------------- |
| `.bar`                          | Header and footer: a white strip on the content column.                 |
| `.page`                         | The screen area between them: a column that fills the window's height. The routed screen lays its parts out directly in it, so the selection bar can sit at its bottom. |
| `.row`                          | Items in a wrapping line, all as tall as the tallest.                   |
| `.page-header`                  | The top of a screen: the title on the left, the screen's buttons on the right, centered on one line. |
| `.title`, `.subtitle`           | The title and its muted 12 px subtitle, stacked in a block exactly as tall as a button. |
| `.icon-tile`                    | A 42 px dark square with a white 20 px icon, placed before a title. Its icon is decorative and hidden from screen readers. |
| `.toolbar`                      | The row above a table: the search, which takes the width, and the **Filters** button at its right end. While its row is open the button is selected: a blue border, blue text, and a `--selected-fill` background. |
| `.search`                       | A search box with a magnifier inside it, on the left.                   |
| `.filter-bar`                   | The filters behind the **Filters** button, in a row under the search: Status, Stock, and Price (€), each a `.field` group with its heading above. |
| `.badge`                        | A small round count on a button, in `--accent`, such as how many filters are set. |
| `.icon-only`                    | A square button holding only an icon, as tall as a field, such as Export, or the ⋮ menu in a product's header. It has an `aria-label`, and a tooltip unless it opens a menu. |
| `data-tooltip`                  | An attribute, not a class: its text shows in a small dark label under the element on hover or keyboard focus. |
| `.table-footer`                 | Under a table, after a line: the page arrows and the range.             |
| `.ribbon`                       | A 24 px red strip under the header, end to end, with a centered 12 px message, for a problem with the whole app such as an unreachable API. Its focus ring is white. |
| `.link`                         | A button that reads like a link, for an action inside a sentence, such as **Try again** on the ribbon. |
| `.clear-filters`                | The **Clear filters** link at the end of the Filters row, 14 px and lined up with the boxes. |
| `button`, `.button`             | Outlined button, as tall as a field. An icon goes before the text, 16 px, drawn with `currentColor`, such as on **Export**. `.button` makes a link look like one. |
| `.sort`                         | A column heading that sorts the table. It keeps the header's `--ink` color and is underlined like a link, so it reads as clickable. It does not change under the pointer. An arrow follows it when the `th` has `aria-sort`. |
| `.primary`                      | The main action, filled with `--accent`, such as **Save changes**.      |
| `.danger`                       | A destructive action, in red text.                                      |
| `.field`                        | A label, its input, and its error message, stacked.                     |
| `.short`                        | A narrow number box, such as a stock or price limit.                    |
| `.section`                      | A part of a screen under its page header, with an `h2` heading, such as Stock and Details on a product's screen. Sections sit on the page background, like the table, with 40 px between them. |
| `.table-scroll`                 | Holds a table, which scrolls sideways when it is too wide. |
| `.pager`                        | The page arrows and the range under a table, kept small.                |
| `.icon-button`                  | A 28 px borderless button holding only an icon, such as a page arrow. It has an `aria-label`. |
| `.pill`                         | A 24 px gray button with a short 12 px text, such as the range "1–8 of 8 products". |
| `.dropdown`, `.menu`            | A button with a small menu of choices. The menu opens above the button, such as the page size, or below it with `.menu.below`, such as Status. `.menu.end` lines it up with the button's right edge, such as a row's ⋮ menu, which opens upward on the last row so the table's scroll box does not cut it off. It has 32 px choices; a chosen page size has `aria-pressed="true"` and a check. |
| `.option`                       | A choice with a checkbox in a menu, such as a status in the Status dropdown. |
| `.select`                       | A button that opens a dropdown, drawn like a field: white, an underline, the current choice, and a chevron. Open, it fills with `--field-focus`. |
| `.number`                       | Right-aligns a table column.                                            |
| `.actions`                      | The last column of a row, as narrow as its ⋮ button. Its header is empty. |
| `.status`                       | A stock badge, a small pill of 12 px text. `data-status`, set to the badge text, picks its color: **In Stock** and **Low** are tinted, **Critical** and **Out of Stock** are solid. |
| `.count`                        | The stock count before its badge, wide enough that the badges line up. |
| `.check`                        | The checkbox column, as narrow as its checkbox. Its header is empty. Checkboxes keep their native look in `--accent`, with a white-on-dark focus ring. |
| `.clickable`                    | A table row that opens something when clicked anywhere: a pointer cursor and `--row-hover` under the pointer. |
| `.name`                         | A product name in a row: bold `--ink` text that is still a link, underlined under the pointer. |
| `.selection-bar`                | Actions for ticked rows: a dark bar 456 px wide and 52 px tall, with 32 px buttons and a semibold count. The count is on the left; a red **Delete**, a 28 px divider, and a close button are on the right. It sticks to the bottom of the window while the page scrolls and stops above the footer, so it never covers the footer or the page numbers. Its focus ring is white, because `--focus` would not show on `--ink`. |
| `.wide`                         | A column hidden on phones, such as ID and Category, so stock stays in view. |
| `.scale`                        | The stock scale. See below.                                             |
| `.reading`                      | The stock line on a product's screen: the scale, the count, and its badge, above the stock controls. |
| `.stock-controls`               | A − and a + icon button around the quantity box, all 32 px tall. The box is 56 px wide, centered, and hides the browser's own arrows. Each button has a tooltip. |
| `dialog`                        | The confirmation dialog, for a delete or for leaving unsaved changes: a white 12 px rounded box, up to 416 px wide, over the page dimmed with `--ink` at half opacity. Its action, **Delete** or **Leave**, is solid red, like **Delete** in the selection bar. |
| `.unsaved`                      | **Unsaved changes** beside the form's buttons: `--warn` text after a small dot. |
| `.muted`, `.error`, `.message`  | Secondary text, red text, and the result of an action.                  |

### Stock scale

Stock is drawn as 20 graduations, like the scale on a stage micrometer. Filled graduations are `--accent`, and empty ones are `--line`. Set `--stock` to the stock count. Each unit fills one graduation, and the CSS caps it with `min()`, so stock of 20 or more fills the scale:

```html
<span class="scale" style="--stock: 6"></span>
```

In the screens, `[style.--stock]="product.stock"` fills it. The table and a product's Stock section both show it before the count and its badge. At zero the scale is empty.

### Phones and access

- Below 40rem, table cells get tighter, `.wide` columns are hidden, the small stock scale narrows to 4rem, so the table fits the screen. At any width, the stock cell wraps its badge under the scale when the table runs out of room. The text in fields grows from 14 px to 16 px, so Safari on iPhone does not zoom in when one is tapped.
- Buttons and links get a 2px `--focus` outline when focused from the keyboard. Fields show focus with their fill and a `--focus` underline instead.
- Nothing moves on its own. There are no animations to turn off for reduced motion.
- Color is never the only signal: out of stock is also written out, and errors are text.

## Layout

```
public/
  zeiss-logo.svg             the ZEISS logo in the header and the browser tab
  staticwebapp.config.json   page addresses on Azure Static Web Apps
src/
  styles.scss                the design system
  environments/              the API address per build
  app/
    app.ts                   the frame: header, screen, footer, and the delete dialog
    app.config.ts            providers, routes, and the guard that asks before leaving unsaved changes
    product.service.ts       types, HTTP calls (one method per endpoint), stockStatus(), errorMessage(), ApiStatus for the ribbon, and Confirmation for the dialog
    product-list.ts          the Products screen
    product-detail.ts        the Product and New product screen
```

## Room for improvement

### Sign-in

Anyone who can open the app can create, edit, and delete products and change stock. There is no sign-in screen, and the API accepts every call (see **Room for improvement** in the [backend README](../backend/README.md)).

- Add a sign-in page and a **Sign out** link in the header. With Microsoft Entra ID, `@azure/msal-angular` signs the user in and gets an access token for the API.
- Send that token with every API call from an HTTP interceptor (`withInterceptors` in `provideHttpClient`). On a 401, send the user back to sign-in.
- Protect the screens that change data, such as `/products/new`, with a route guard (`CanActivateFn`). Hide the actions the user's role does not allow, such as **Delete** in the ⋮ menus.
- Static Web Apps has built-in sign-in, with Microsoft Entra ID and GitHub on the Free plan. It protects the static files only. The API runs on App Service, on another address, so the API must still check the token itself.

### Live updates across clients

Each open screen asks the API again every 15 seconds (`REFRESH_MS`). A change made in another browser takes up to 15 seconds to appear. Every open screen sends 4 requests a minute even when nothing changed, and the list request returns every product each time.

- Keep a two-way connection open instead. The API pushes a message such as "product 100001 changed" over SignalR, which uses WebSockets, and each screen updates only that product. The browser client is `@microsoft/signalr`. The server side is in the backend README.
- Keep the 15-second refresh as a fallback while the connection is down.
- In Docker and Kubernetes, nginx must pass the WebSocket upgrade through on the SignalR path: `proxy_http_version 1.1` and the `Upgrade` and `Connection` headers.
- Warn about conflicting edits. If two people edit the same product, the last **Save changes** wins without a warning. With a version on each product, sent as an ETag by the API, the form can say that the product changed since it was opened and offer to reload it.

### Search, sorting, and paging on the backend

The API has one endpoint for a name search and another for a stock range, and neither sorts or pages. So part of the work happens in the browser today:

- A search and a stock range together: the app runs the search and keeps the products in the range itself.
- Every keystroke in the search or a filter sends a request. The app is kept simple and does not wait for typing to pause.
- Sorting by name, category, or price, and splitting the result into pages, happen in the app on the full list.
- Every search and every 15-second refresh downloads every matching product, even when the table shows 10.

That works for the 8 seed products. With thousands it would be slow, and the total and the page numbers would only be right because the whole list was downloaded.

- Add one list endpoint that takes every option as a query parameter, for example `GET /api/products?name=stemi&minStock=1&maxStock=20&sort=price&order=desc&page=1&pageSize=10`. It should return one page and the total, such as `{ "items": [...], "total": 42 }`.
- Let the database do the work. EF Core turns `Where`, `OrderBy`, `Skip`, and `Take` into one SQL query, so only one page leaves the database.
- In the app, send the filters, sort, and page as those parameters, wait for a pause in typing (`debounceTime(300)`) so a word sends one request, and take the total for the footer from the response. The sorting, combined filtering, and paging code in `product-list.ts` then goes away.
- Keep `GET /api/products/search` and `GET /api/products/stock-level`. The assessment asks for them.
- Add a bulk delete, such as `POST /api/products/delete` with a list of ids, so the selection bar sends one request instead of one per product, and the deletes succeed or fail together.
