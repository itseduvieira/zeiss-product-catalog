import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, interval } from 'rxjs';
import { ApiStatus, Category, Confirmation, Notice, ProductService, REFRESH_MS, deletedText, errorMessage, isUnreachable } from './product.service';

type SortColumn = 'name' | 'products';

@Component({
  selector: 'app-category-list',
  host: {
    '(document:click)': 'closeMenuOnClickOutside($event)',
    '(document:keydown.escape)': 'closeMenu()',
    '(window:scroll)': 'closeMenu()',
    '(window:resize)': 'closeMenu()',
  },
  imports: [FormsModule, RouterLink],
  template: `
    <header class="page-header">
      <div class="row">
        <span class="icon-tile" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
            <path d="M3 3h7l7 7-7 7-7-7V3z" />
            <circle cx="7" cy="7" r="1.25" />
          </svg>
        </span>
        <div class="title">
          <h1>Categories</h1>
          <p class="subtitle">Group the products in the catalog</p>
        </div>
      </div>
      <div class="row">
        <a class="button primary" routerLink="/categories/new">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke-linecap="round" />
          </svg>
          New category
        </a>
      </div>
    </header>

    <div class="toolbar">
      <div class="search">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" stroke-linecap="round" />
        </svg>
        <input type="search" aria-label="Search by name or description" placeholder="Search by name or description" [(ngModel)]="searchText" />
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
        <button type="button" [attr.aria-pressed]="emptyOnly()" (click)="emptyOnly.set(!emptyOnly())">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">
            <path d="M2.5 6.5h11v6h-11zM2.5 6.5l2-3h7l2 3" />
          </svg>
          Empty only
        </button>
        @if (activeFilterCount() > 0) {
          <button class="link clear-filters" type="button" (click)="emptyOnly.set(false)">Clear filters</button>
        }
      </div>
    }

    @if (loading() && categories().length === 0) {
      <p class="muted">Loading categories…</p>
    } @else if (rows().length > 0) {
      <div class="table-scroll" (scroll)="closeMenu()">
        <table>
          <thead>
            <tr>
              <th class="check" aria-label="Select"></th>
              <th class="wide">ID</th>
              <th [attr.aria-sort]="ariaSort('name')">
                <button class="sort" type="button" (click)="sortBy('name')">Name</button>
              </th>
              <th class="wide">Description</th>
              <th class="number" [attr.aria-sort]="ariaSort('products')">
                <button class="sort" type="button" (click)="sortBy('products')">Products</button>
              </th>
              <th class="actions" aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            @for (category of rows(); track category.id) {
              <tr class="clickable" (click)="openCategory($event, category.id)">
                <td class="check">
                  @if (!category.isUncategorized) {
                    <input type="checkbox" [attr.aria-label]="'Select ' + category.name" [checked]="selectedIds().includes(category.id)" (change)="toggleSelected(category.id)" />
                  }
                </td>
                <td class="wide muted">{{ category.id }}</td>
                <td><a class="name" [routerLink]="['/categories', category.id]">{{ category.name }}</a></td>
                <td class="wide muted">{{ category.description }}</td>
                <td class="number">{{ category.productCount }}</td>
                <td class="actions">
                @if (!category.isUncategorized) {
                  <div class="dropdown">
                    <button
                      class="icon-button"
                      type="button"
                      aria-haspopup="true"
                      [attr.aria-label]="'Actions for ' + category.name"
                      [attr.aria-expanded]="openMenu() === category.id"
                      (click)="toggleRowMenu($event, category.id)"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <circle cx="8" cy="3" r="1.25" />
                        <circle cx="8" cy="8" r="1.25" />
                        <circle cx="8" cy="13" r="1.25" />
                      </svg>
                    </button>
                    @if (openMenu() === category.id) {
                      <div
                        class="menu row-menu"
                        role="group"
                        [attr.aria-label]="'Actions for ' + category.name"
                        [style.top.px]="menuPlace().top"
                        [style.bottom.px]="menuPlace().bottom"
                        [style.right.px]="menuPlace().right"
                      >
                        <button type="button" (click)="editCategory(category.id)">
                          Edit
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                            <path d="M10.5 2.5l3 3L5 14H2v-3l8.5-8.5z" stroke-linejoin="round" />
                          </svg>
                        </button>
                        @if (!category.isUncategorized) {
                          <button class="danger" type="button" (click)="deleteCategories([category])">
                            Delete
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                              <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.75 7v4M9.25 7v4" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                          </button>
                        }
                      </div>
                    }
                  </div>
                }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (selectedCategories().length > 0) {
        <div class="selection-bar" role="region" aria-label="Selected categories">
          <span class="count">{{ selectedCategories().length }} selected</span>
          <button class="danger" type="button" (click)="deleteCategories(selectedCategories())">
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
        @if (searchText().trim() || activeFilterCount() > 0) {
          <p class="muted">No categories match your search</p>
          <button type="button" (click)="clearSearch()">Clear search</button>
        } @else {
          <p class="muted">There are no categories yet</p>
        }
      </div>
    }
  `,
})
export class CategoryList {
  private readonly service = inject(ProductService);
  private readonly router = inject(Router);
  private readonly confirmation = inject(Confirmation);
  private readonly notice = inject(Notice);
  protected readonly api = inject(ApiStatus);

  protected readonly categories = signal<Category[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly searchText = signal('');
  protected readonly filtersOpen = signal(false);
  protected readonly emptyOnly = signal(false);
  protected readonly sortColumn = signal<SortColumn | null>(null);
  protected readonly sortAscending = signal(true);
  protected readonly openMenu = signal<number | null>(null);
  protected readonly selectedIds = signal<number[]>([]);
  protected readonly menuPlace = signal<{ top?: number; bottom?: number; right: number }>({
    right: 0,
  });

  protected readonly rows = computed(() => {
    const text = this.searchText().trim().toLowerCase();
    const rows = this.categories().filter((c) => (c.name.toLowerCase().includes(text) || c.description.toLowerCase().includes(text)) && (!this.emptyOnly() || c.productCount === 0));
    const column = this.sortColumn();
    if (column) {
      rows.sort((a, b) => (column === 'name' ? a.name.localeCompare(b.name) : a.productCount - b.productCount));
      if (!this.sortAscending()) {
        rows.reverse();
      }
    }
    return rows;
  });

  protected readonly selectedCategories = computed(() => this.rows().filter((c) => this.selectedIds().includes(c.id)));

  constructor() {
    this.load();
    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.load());
  }

  protected load(): void {
    this.loading.set(true);
    this.service.getCategories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.loaded();
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loadFailed(error);
        this.loading.set(false);
      },
    });
  }

  private loaded(): void {
    if (this.error() && this.notice.text() === this.error()) {
      this.notice.close();
    }
    this.error.set(null);
    this.api.unreachable.set(false);
  }

  private loadFailed(error: HttpErrorResponse): void {
    this.api.unreachable.set(isUnreachable(error));
    const message = isUnreachable(error) ? null : errorMessage(error);
    if (message && !this.error()) {
      this.notice.showError(message, { label: 'Try again', run: () => this.load() });
    }
    this.error.set(message);
  }

  protected activeFilterCount(): number {
    return this.emptyOnly() ? 1 : 0;
  }

  protected clearSearch(): void {
    this.searchText.set('');
    this.emptyOnly.set(false);
  }

  protected sortBy(column: SortColumn): void {
    if (this.sortColumn() === column) {
      this.sortAscending.set(!this.sortAscending());
    } else {
      this.sortColumn.set(column);
      this.sortAscending.set(true);
    }
  }

  protected ariaSort(column: SortColumn): string {
    if (this.sortColumn() !== column) {
      return 'none';
    }
    return this.sortAscending() ? 'ascending' : 'descending';
  }

  protected openCategory(event: MouseEvent, id: number): void {
    if ((event.target as HTMLElement).closest('a, input, .dropdown')) {
      return;
    }
    this.router.navigate(['/categories', id]);
  }

  protected toggleRowMenu(event: MouseEvent, id: number): void {
    const button = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const viewport = document.documentElement;
    const right = viewport.clientWidth - button.right;
    const fitsBelow = button.bottom + 100 <= viewport.clientHeight;
    this.menuPlace.set(fitsBelow ? { top: button.bottom + 4, right } : { bottom: viewport.clientHeight - button.top + 4, right });
    this.openMenu.set(this.openMenu() === id ? null : id);
  }

  protected closeMenu(): void {
    this.openMenu.set(null);
  }

  protected closeMenuOnClickOutside(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.dropdown')) {
      this.closeMenu();
    }
  }

  protected editCategory(id: number): void {
    this.closeMenu();
    this.router.navigate(['/categories', id]);
  }

  protected toggleSelected(id: number): void {
    const ids = this.selectedIds();
    this.selectedIds.set(ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]);
  }

  protected async deleteCategories(categories: Category[]): Promise<void> {
    this.closeMenu();
    const moved = categories.reduce((total, c) => total + c.productCount, 0);
    const what = categories.length === 1 ? `"${categories[0].name}"` : `${categories.length} categories`;
    if (!(await this.confirmation.askToDelete(what, moved))) {
      return;
    }
    const ids = categories.map((c) => c.id);
    forkJoin(categories.map((c) => this.service.deleteCategory(c.id, c.productCount > 0))).subscribe({
      next: () => {
        this.selectedIds.set(this.selectedIds().filter((id) => !ids.includes(id)));
        this.notice.show(deletedText(categories.length === 1 ? categories[0].name : `${categories.length} categories`, moved));
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.notice.show(errorMessage(error), true);
        this.load();
      },
    });
  }
}
