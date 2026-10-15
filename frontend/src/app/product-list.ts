import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, Subscription, forkJoin, interval } from 'rxjs';
import {
  ApiStatus,
  Confirmation,
  Product,
  ProductService,
  REFRESH_MS,
  STOCK_STATUSES,
  StockStatus,
  errorMessage,
  formatPrice,
  isUnreachable,
  stockStatus,
} from './product.service';

type SortColumn = 'name' | 'category' | 'price';

type Menu = 'status' | 'page-size' | number;

const MAX_STOCK = 1000000;

const compareBy: Record<SortColumn, (a: Product, b: Product) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  category: (a, b) => a.categoryName.localeCompare(b.categoryName) || a.name.localeCompare(b.name),
  price: (a, b) => a.price - b.price,
};

function inRange(value: number, min: number | null, max: number | null): boolean {
  return (min === null || value >= min) && (max === null || value <= max);
}

export function productsCsv(products: Product[]): string {
  const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const header = ['Product number', 'Name', 'Category', 'Price (€)', 'Stock'];
  const rows = products.map((p) => [p.id, p.name, p.categoryName, formatPrice(p.price), p.stock]);
  return [header, ...rows].map((row) => row.map(cell).join(',')).join('\n');
}

@Component({
  selector: 'app-product-list',
  host: { '(document:click)': 'closeMenuOnClickOutside($event)', '(document:keydown.escape)': 'closeMenu()' },
  imports: [FormsModule, RouterLink],
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
          <p class="subtitle">Manage products and their stock</p>
        </div>
      </div>
      <div class="row">
        <button class="icon-only" type="button" aria-label="Export as CSV" data-tooltip="Export as CSV" (click)="export()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M8 2v8m-3-3 3 3 3-3M3 12v2h10v-2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <a class="button primary" routerLink="/products/new">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke-linecap="round" />
          </svg>
          New product
        </a>
      </div>
    </header>

    <div class="toolbar">
      <div class="search">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" stroke-linecap="round" />
        </svg>
        <input type="search" aria-label="Search by name, ID or category" placeholder="Search by name, ID or category" [(ngModel)]="searchText" (ngModelChange)="filterChanged()" />
      </div>
      <button type="button" [attr.aria-expanded]="filtersOpen()" (click)="filtersOpen.set(!filtersOpen())">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M2 4h12M4.5 8h7M7 12h2" stroke-linecap="round" />
        </svg>
        Filters
        @if (activeFilterCount() > 0) {
          <span class="badge" [attr.aria-label]="activeFilterCount() + ' active'">{{ activeFilterCount() }}</span>
        }
      </button>
    </div>

    @if (filtersOpen()) {
      <div class="filter-bar">
        <div class="field">
          <span id="status-filter">Status</span>
          <div class="dropdown">
            <button
              class="select"
              type="button"
              aria-haspopup="true"
              aria-labelledby="status-filter status-value"
              [attr.aria-expanded]="openMenu() === 'status'"
              (click)="toggleMenu('status')"
            >
              <span id="status-value">{{ statusSummary() }}</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            @if (openMenu() === 'status') {
              <div class="menu below" role="group" aria-labelledby="status-filter">
                @for (status of stockStatuses; track status) {
                  <label class="option">
                    <input type="checkbox" [checked]="checkedStatuses().includes(status)" (change)="toggleStatus(status)" />
                    <span class="status" [attr.data-status]="status">{{ status }}</span>
                  </label>
                }
              </div>
            }
          </div>
        </div>
        <div class="field" role="group" aria-labelledby="stock-filter">
          <span id="stock-filter">Stock</span>
          <div class="row">
            <input class="short" type="number" min="0" aria-label="Min stock" placeholder="Min" [(ngModel)]="minStock" (ngModelChange)="filterChanged()" />
            <input class="short" type="number" min="0" aria-label="Max stock" placeholder="Max" [(ngModel)]="maxStock" (ngModelChange)="filterChanged()" />
          </div>
        </div>
        <div class="field" role="group" aria-labelledby="price-filter">
          <span id="price-filter">Price (€)</span>
          <div class="row">
            <input class="short" type="number" min="0" step="0.01" aria-label="Min price (€)" placeholder="Min" [(ngModel)]="minPrice" (ngModelChange)="filterChanged()" />
            <input class="short" type="number" min="0" step="0.01" aria-label="Max price (€)" placeholder="Max" [(ngModel)]="maxPrice" (ngModelChange)="filterChanged()" />
          </div>
        </div>
        @if (activeFilterCount() > 0) {
          <button class="link clear-filters" type="button" (click)="clearFilters()">Clear filters</button>
        }
      </div>
    }

    @if (error()) {
      <p class="error">{{ error() }} <button type="button" (click)="load()">Try again</button></p>
    }

    @if (loading() && products().length === 0) {
      <p class="muted">Loading products…</p>
    } @else if (rows().length > 0) {
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th class="check" aria-label="Select"></th>
              <th class="wide">ID</th>
              <th [attr.aria-sort]="ariaSort('name')">
                <button class="sort" type="button" (click)="sortBy('name')">Name</button>
              </th>
              <th class="wide" [attr.aria-sort]="ariaSort('category')">
                <button class="sort" type="button" (click)="sortBy('category')">Category</button>
              </th>
              <th class="number" [attr.aria-sort]="ariaSort('price')">
                <button class="sort" type="button" (click)="sortBy('price')">Price (€)</button>
              </th>
              <th>Stock</th>
              <th class="actions" aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            @for (product of pageRows(); track product.id; let last = $last) {
              <tr class="clickable" (click)="openProduct($event, product.id)">
                <td class="check">
                  <input
                    type="checkbox"
                    [attr.aria-label]="'Select ' + product.name"
                    [checked]="selectedIds().includes(product.id)"
                    (change)="toggleSelected(product.id)"
                  />
                </td>
                <td class="wide muted">{{ product.id }}</td>
                <td><a class="name" [routerLink]="['/products', product.id]">{{ product.name }}</a></td>
                <td class="wide">{{ product.categoryName }}</td>
                <td class="number">{{ formatPrice(product.price) }}</td>
                <td>
                  <span class="scale" [style.--stock]="product.stock"></span>
                  <span class="count">{{ product.stock }}</span>
                  <span class="status" [attr.data-status]="stockStatus(product.stock)">{{ stockStatus(product.stock) }}</span>
                </td>
                <td class="actions">
                  <div class="dropdown">
                    <button
                      class="icon-button"
                      type="button"
                      aria-haspopup="true"
                      [attr.aria-label]="'Actions for ' + product.name"
                      [attr.aria-expanded]="openMenu() === product.id"
                      (click)="toggleMenu(product.id)"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <circle cx="8" cy="3" r="1.25" />
                        <circle cx="8" cy="8" r="1.25" />
                        <circle cx="8" cy="13" r="1.25" />
                      </svg>
                    </button>
                    @if (openMenu() === product.id) {
                      <div class="menu end" [class.below]="!last" role="group" [attr.aria-label]="'Actions for ' + product.name">
                        <button class="danger" type="button" (click)="deleteProducts([product])">
                          Delete
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                            <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.75 7v4M9.25 7v4" stroke-linecap="round" stroke-linejoin="round" />
                          </svg>
                        </button>
                      </div>
                    }
                  </div>
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
          <div class="dropdown">
            <button class="pill" type="button" aria-haspopup="true" [attr.aria-expanded]="openMenu() === 'page-size'" (click)="toggleMenu('page-size')">
              {{ pageStart() + 1 }}–{{ pageStart() + pageRows().length }} of {{ rows().length }} products
            </button>
            @if (openMenu() === 'page-size') {
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
          <button class="danger" type="button" (click)="deleteProducts(selectedProducts())">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.75 7v4M9.25 7v4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Delete
          </button>
          <span class="divider"></span>
          <button class="close" type="button" aria-label="Clear selection" (click)="selectedIds.set([])">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      }
    } @else if (!error() && !api.unreachable()) {
      <div>
        @if (hasSearchOrFilters()) {
          <p class="muted">No products match your search</p>
          <button type="button" (click)="clearSearchAndFilters()">Clear search</button>
        } @else {
          <p class="muted">There are no products yet</p>
        }
      </div>
    }
  `,
})
export class ProductList {
  private readonly service = inject(ProductService);
  private readonly router = inject(Router);
  protected readonly api = inject(ApiStatus);
  private readonly confirmation = inject(Confirmation);
  private loadSubscription?: Subscription;

  protected readonly stockStatus = stockStatus;
  protected readonly formatPrice = formatPrice;
  protected readonly stockStatuses = STOCK_STATUSES;
  protected readonly pageSizes = [5, 10, 20];

  protected readonly products = signal<Product[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly searchText = signal('');
  protected readonly filtersOpen = signal(false);
  protected readonly checkedStatuses = signal<StockStatus[]>([]);
  protected readonly minStock = signal<number | null>(null);
  protected readonly maxStock = signal<number | null>(null);
  protected readonly minPrice = signal<number | null>(null);
  protected readonly maxPrice = signal<number | null>(null);

  protected readonly sortColumn = signal<SortColumn | null>(null);
  protected readonly sortAscending = signal(true);

  protected readonly openMenu = signal<Menu | null>(null);

  protected readonly selectedIds = signal<number[]>([]);

  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);

  protected readonly rows = computed(() => {
    const statuses = this.checkedStatuses();
    const rows = this.products().filter(
      (p) =>
        inRange(p.price, this.minPrice(), this.maxPrice()) &&
        inRange(p.stock, this.minStock(), this.maxStock()) &&
        (statuses.length === 0 || statuses.includes(stockStatus(p.stock))),
    );
    const column = this.sortColumn();
    if (column) {
      rows.sort(compareBy[column]);
      if (!this.sortAscending()) {
        rows.reverse();
      }
    }
    return rows;
  });

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.rows().length / this.pageSize())));
  protected readonly currentPage = computed(() => Math.min(this.page(), this.pageCount()));
  protected readonly pageStart = computed(() => (this.currentPage() - 1) * this.pageSize());
  protected readonly pageRows = computed(() => this.rows().slice(this.pageStart(), this.pageStart() + this.pageSize()));

  protected readonly selectedProducts = computed(() => this.rows().filter((p) => this.selectedIds().includes(p.id)));

  constructor() {
    this.load();
    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.load());
  }

  protected load(): void {
    this.loading.set(true);
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.request().subscribe({
      next: (products) => {
        this.products.set(products);
        this.error.set(null);
        this.api.unreachable.set(false);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.api.unreachable.set(isUnreachable(error));
        this.error.set(isUnreachable(error) ? null : errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  private request(): Observable<Product[]> {
    const text = this.searchText().trim();
    const min = this.minStock();
    const max = this.maxStock();
    if (text) {
      return this.service.search(text);
    }
    if (min !== null || max !== null) {
      return this.service.getByStockLevel(min ?? 0, max ?? MAX_STOCK);
    }
    return this.service.getAll();
  }

  protected filterChanged(): void {
    this.page.set(1);
    this.load();
  }

  protected activeFilterCount(): number {
    const values = [this.minStock(), this.maxStock(), this.minPrice(), this.maxPrice()];
    return values.filter((value) => value !== null).length + (this.checkedStatuses().length > 0 ? 1 : 0);
  }

  protected hasSearchOrFilters(): boolean {
    return this.searchText().trim() !== '' || this.activeFilterCount() > 0;
  }

  protected statusSummary(): string {
    const checked = this.checkedStatuses();
    if (checked.length === 0) {
      return 'All';
    }
    return checked.length === 1 ? checked[0] : `${checked.length} selected`;
  }

  protected toggleStatus(status: StockStatus): void {
    const checked = this.checkedStatuses();
    this.checkedStatuses.set(checked.includes(status) ? checked.filter((s) => s !== status) : [...checked, status]);
    this.filterChanged();
  }

  protected clearFilters(): void {
    this.checkedStatuses.set([]);
    this.minStock.set(null);
    this.maxStock.set(null);
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.filterChanged();
  }

  protected clearSearchAndFilters(): void {
    this.searchText.set('');
    this.clearFilters();
  }

  protected sortBy(column: SortColumn): void {
    if (this.sortColumn() === column) {
      this.sortAscending.set(!this.sortAscending());
    } else {
      this.sortColumn.set(column);
      this.sortAscending.set(true);
    }
    this.page.set(1);
  }

  protected ariaSort(column: SortColumn): string {
    if (this.sortColumn() !== column) {
      return 'none';
    }
    return this.sortAscending() ? 'ascending' : 'descending';
  }

  protected toggleMenu(menu: Menu): void {
    this.openMenu.set(this.openMenu() === menu ? null : menu);
  }

  protected closeMenu(): void {
    this.openMenu.set(null);
  }

  protected closeMenuOnClickOutside(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.dropdown')) {
      this.closeMenu();
    }
  }

  protected setPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    this.closeMenu();
  }

  protected openProduct(event: MouseEvent, id: number): void {
    if ((event.target as HTMLElement).closest('a, input, .dropdown')) {
      return;
    }
    this.router.navigate(['/products', id]);
  }

  protected toggleSelected(id: number): void {
    const ids = this.selectedIds();
    this.selectedIds.set(ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]);
  }

  protected async deleteProducts(products: Product[]): Promise<void> {
    this.closeMenu();
    const what = products.length === 1 ? `"${products[0].name}"` : `${products.length} products`;
    if (!(await this.confirmation.askToDelete(what))) {
      return;
    }
    const ids = products.map((p) => p.id);
    forkJoin(ids.map((id) => this.service.delete(id))).subscribe({
      next: () => {
        this.selectedIds.set(this.selectedIds().filter((id) => !ids.includes(id)));
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(errorMessage(error));
        this.load();
      },
    });
  }

  protected export(): void {
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFF' + productsCsv(this.rows()));
    link.download = 'products.csv';
    link.click();
  }
}
