import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, Subject, Subscription, debounceTime, forkJoin, interval, map } from 'rxjs';
import { Product, ProductService, REFRESH_MS, errorMessage, scaleLevel } from './product.service';

type SortColumn = 'name' | 'category' | 'price';

interface Sort {
  column: SortColumn;
  /** 1 for ascending, -1 for descending */
  direction: 1 | -1;
}

/** The API's highest allowed stock. A range with no maximum runs up to it. */
const MAX_STOCK = 1000000;

const compareBy: Record<SortColumn, (a: Product, b: Product) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  category: (a, b) => a.categoryName.localeCompare(b.categoryName) || a.name.localeCompare(b.name),
  price: (a, b) => a.price - b.price,
};

/** The products as a CSV file: one header row, then one row per product. Values with commas or quotes are quoted. */
export function productsCsv(products: Product[]): string {
  const cell = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = ['Product number', 'Name', 'Category', 'Price (EUR)', 'Stock'];
  const rows = products.map((p) => [p.id, p.name, p.categoryName, p.price.toFixed(2), p.stock]);
  return [header, ...rows].map((row) => row.map(cell).join(',')).join('\n');
}

/** Master screen: every product with its stock. A name opens the product's own screen. */
@Component({
  selector: 'app-product-list',
  // The page size menu closes on a click outside it or on Escape.
  host: { '(document:click)': 'closeMenuOutside($event)', '(document:keydown.escape)': 'menuOpen.set(false)' },
  imports: [CurrencyPipe, FormsModule, RouterLink],
  template: `
    <header class="page-header">
      <div class="row">
        <span class="icon-tile" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
            <path d="M10 2l7 3.5v9L10 18l-7-3.5v-9L10 2z" />
            <path d="M3 5.5L10 9l7-3.5M10 9v9" />
          </svg>
        </span>
        <div class="title">
          <h1>Product catalog</h1>
          <p class="subtitle">Prices and stock for every product.</p>
        </div>
      </div>
      <div class="row">
        <button type="button" (click)="export()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M8 2v8m-3-3 3 3 3-3M3 12v2h10v-2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Export
        </button>
        <a class="button primary" routerLink="/products/new">New product</a>
      </div>
    </header>

    <div class="row toolbar">
      <label class="field grow">
        <span>Name</span>
        <input type="search" placeholder="Search by name" [(ngModel)]="name" (ngModelChange)="filterChanged()" />
      </label>
      <label class="field">
        <span>Min stock</span>
        <input class="short" type="number" min="0" [(ngModel)]="min" (ngModelChange)="filterChanged()" />
      </label>
      <label class="field">
        <span>Max stock</span>
        <input class="short" type="number" min="0" [(ngModel)]="max" (ngModelChange)="filterChanged()" />
      </label>
    </div>

    @if (error()) {
      <p class="error">{{ error() }} <button type="button" (click)="load()">Try again</button></p>
    }

    @if (loading() && products().length === 0) {
      <p class="muted">Loading products…</p>
    } @else if (products().length > 0) {
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th class="check" aria-label="Select"></th>
              <th [attr.aria-sort]="ariaSort('name')">
                <button class="sort" type="button" (click)="sortBy('name')">Name</button>
              </th>
              <th class="wide" [attr.aria-sort]="ariaSort('category')">
                <button class="sort" type="button" (click)="sortBy('category')">Category</button>
              </th>
              <th class="number" [attr.aria-sort]="ariaSort('price')">
                <button class="sort" type="button" (click)="sortBy('price')">Price</button>
              </th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            @for (product of pageRows(); track product.id) {
              <tr class="clickable" (click)="openRow($event, product.id)">
                <td class="check">
                  <input
                    type="checkbox"
                    [attr.aria-label]="'Select ' + product.name"
                    [checked]="selected().has(product.id)"
                    (change)="toggle(product.id)"
                  />
                </td>
                <td><a class="name" [routerLink]="['/products', product.id]">{{ product.name }}</a></td>
                <td class="wide">{{ product.categoryName }}</td>
                <td class="number">{{ product.price | currency: 'EUR' }}</td>
                <td class="nowrap">
                  <span class="scale" [style.--level]="scaleLevel(product.stock)"></span>
                  @if (product.stock === 0) {
                    <span class="error">Out of stock</span>
                  } @else {
                    {{ product.stock }}
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <footer class="table-footer">
        <nav class="pager" aria-label="Pages">
          <button class="icon-button" type="button" aria-label="Previous page" [disabled]="currentPage() === 1" (click)="page.set(currentPage() - 1)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M10 3.5L5.5 8l4.5 4.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button class="icon-button" type="button" aria-label="Next page" [disabled]="currentPage() === pageCount()" (click)="page.set(currentPage() + 1)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M6 3.5L10.5 8 6 12.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <div class="page-size">
            <button class="pill" type="button" aria-haspopup="true" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(!menuOpen())">
              {{ firstRow() }}–{{ lastRow() }} of {{ products().length }} products
            </button>
            @if (menuOpen()) {
              <div class="menu" role="group" aria-labelledby="page-size-heading">
                <p id="page-size-heading">Products per page</p>
                @for (size of pageSizes; track size) {
                  <button type="button" [attr.aria-pressed]="size === pageSize()" (click)="setPageSize(size)">
                    {{ size }}
                    @if (size === pageSize()) {
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                        <circle cx="8" cy="8" r="7" fill="currentColor" />
                        <path d="M5 8.2l2 2 4-4.2" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    }
                  </button>
                }
              </div>
            }
          </div>
        </nav>
      </footer>

      @if (selectedProducts().length > 0) {
        <div class="selection-bar" role="region" aria-label="Selected products">
          <span class="count">{{ selectedProducts().length }} selected</span>
          <button class="danger" type="button" (click)="deleteSelected()">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.75 7v4M9.25 7v4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Delete
          </button>
          <span class="divider"></span>
          <button class="close" type="button" aria-label="Clear selection" (click)="clearSelection()">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      }
    } @else if (!error()) {
      <div>
        @if (filtered()) {
          <p class="muted">No products match your search.</p>
          <button type="button" (click)="clear()">Clear search</button>
        } @else {
          <p class="muted">There are no products yet.</p>
        }
      </div>
    }
  `,
})
export class ProductList {
  private readonly service = inject(ProductService);
  private readonly router = inject(Router);
  private readonly filterChanges = new Subject<void>();
  private loadSubscription?: Subscription;

  protected readonly scaleLevel = scaleLevel;
  protected readonly products = signal<Product[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sort = signal<Sort>({ column: 'name', direction: 1 });
  /** The products in the chosen order. Sorting happens here, because the API has no sort. */
  protected readonly rows = computed(() => {
    const { column, direction } = this.sort();
    return [...this.products()].sort((a, b) => compareBy[column](a, b) * direction);
  });

  // Paging happens here too, because the API returns the whole list.
  protected readonly pageSizes = [5, 10, 20];
  protected readonly pageSize = signal(10);
  protected readonly page = signal(1);
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.products().length / this.pageSize())));
  /** The chosen page, or the last one when a search leaves fewer pages. */
  protected readonly currentPage = computed(() => Math.min(this.page(), this.pageCount()));
  /** The first and last product on the page, counted from 1, for "1–10 of 12 products". */
  protected readonly firstRow = computed(() => (this.currentPage() - 1) * this.pageSize() + 1);
  protected readonly lastRow = computed(() => Math.min(this.currentPage() * this.pageSize(), this.products().length));
  protected readonly menuOpen = signal(false);
  protected readonly pageRows = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.rows().slice(start, start + this.pageSize());
  });

  protected name = '';
  protected min: number | null = null;
  protected max: number | null = null;

  constructor() {
    this.load();
    // Searches 300 ms after the last keystroke, so typing a word sends one request.
    this.filterChanges.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.load());
    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.load());
  }

  protected filterChanged(): void {
    this.page.set(1);
    this.filterChanges.next();
  }

  /** A click anywhere on a row opens the product. The name link and the checkbox handle their own clicks. */
  protected openRow(event: MouseEvent, id: number): void {
    if ((event.target as HTMLElement).closest('a, input')) {
      return;
    }
    this.router.navigate(['/products', id]);
  }

  /** The ids of the rows whose checkbox is ticked. */
  protected readonly selected = signal(new Set<number>());
  /** The ticked products that the filters still show. Actions apply to these only, never to hidden ones. */
  protected readonly selectedProducts = computed(() => this.rows().filter((p) => this.selected().has(p.id)));

  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  /** Deletes the ticked products after a confirmation. The API has no bulk delete, so it sends one request each. */
  protected deleteSelected(): void {
    const products = this.selectedProducts();
    const question = products.length === 1 ? `Delete "${products[0].name}"?` : `Delete ${products.length} products?`;
    if (!confirm(question)) {
      return;
    }
    forkJoin(products.map((p) => this.service.delete(p.id))).subscribe({
      next: () => {
        this.clearSelection();
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(errorMessage(error));
        this.load();
      },
    });
  }

  protected toggle(id: number): void {
    const selected = new Set(this.selected());
    if (!selected.delete(id)) {
      selected.add(id);
    }
    this.selected.set(selected);
  }

  /**
   * Downloads the ticked products, or, with none ticked, every product that matches the filters.
   * Either way in the table's order and across all pages.
   */
  protected export(): void {
    const products = this.selectedProducts().length > 0 ? this.selectedProducts() : this.rows();
    // The byte order mark lets Excel read the file as UTF-8.
    const file = new Blob(['\uFEFF' + productsCsv(products)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'products.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  protected setPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    this.menuOpen.set(false);
  }

  protected closeMenuOutside(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.page-size')) {
      this.menuOpen.set(false);
    }
  }

  /** A click on a column heading sorts by it. A second click on the same heading reverses the order. */
  protected sortBy(column: SortColumn): void {
    const current = this.sort();
    const direction = current.column === column ? (current.direction === 1 ? -1 : 1) : 1;
    this.sort.set({ column, direction });
    this.page.set(1);
  }

  protected ariaSort(column: SortColumn): 'ascending' | 'descending' | 'none' {
    const { column: sorted, direction } = this.sort();
    if (sorted !== column) {
      return 'none';
    }
    return direction === 1 ? 'ascending' : 'descending';
  }

  protected filtered(): boolean {
    return this.name.trim() !== '' || this.min !== null || this.max !== null;
  }

  protected clear(): void {
    this.name = '';
    this.min = null;
    this.max = null;
    this.page.set(1);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.request().subscribe({
      next: (products) => {
        this.products.set(products);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  /** Picks the endpoint for what is typed in the search boxes. Empty boxes list everything. */
  private request(): Observable<Product[]> {
    const name = this.name.trim();
    if (this.min === null && this.max === null) {
      return name ? this.service.search(name) : this.service.getAll();
    }
    const inRange = this.service.getByStockLevel(this.min ?? 0, this.max ?? MAX_STOCK);
    if (!name) {
      return inRange;
    }
    // The API has no query for name and stock together, so the name filters the range result here.
    const term = name.toLowerCase();
    return inRange.pipe(map((products) => products.filter((p) => p.name.toLowerCase().includes(term))));
  }
}
