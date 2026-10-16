import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CategoryPicker } from './category-picker';
import { NotFound } from './not-found';
import { interval } from 'rxjs';
import {
  ApiStatus,
  Category,
  Confirmation,
  Notice,
  Product,
  ProductInput,
  ProductService,
  REFRESH_MS,
  errorMessage,
  formatPrice,
  isUnreachable,
  stockStatus,
} from './product.service';

export function parsePrice(text: string): number {
  return Number(text.replace(/\./g, '').replace(',', '.'));
}

export function maskPrice(text: string): string {
  const digits = text.replace(/\D/g, '');
  return digits === '' ? '' : formatPrice(Number(digits) / 100);
}

function priceInRange(control: AbstractControl<string>): ValidationErrors | null {
  const price = parsePrice(control.value);
  return control.value === '' || (price > 0 && price <= 1000000) ? null : { priceRange: true };
}

@Component({
  selector: 'app-product-detail',
  host: {
    '(document:click)': 'closeMenuOnClickOutside($event)',
    '(document:keydown.escape)': 'menuOpen.set(false)',
    '(window:beforeunload)': 'warnBeforeUnload($event)',
  },
  imports: [CategoryPicker, NotFound, ReactiveFormsModule, RouterLink],
  template: `
    @if (notFound()) {
      <app-not-found title="Product not found" [message]="'There is no product ' + id() + ' in the catalog'" />
    }

    @if (product() || isNew()) {
      <header class="page-header">
        <div class="row">
          <span class="icon-tile" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
              <path d="M10 2l7 3.5v9L10 18l-7-3.5v-9L10 2z" />
              <path d="M3 5.5L10 9l7-3.5M10 9v9" />
            </svg>
          </span>
          <div class="title">
            @if (product(); as product) {
              <h1>{{ product.name }}</h1>
              <p class="subtitle">Product number {{ product.id }}</p>
            } @else {
              <h1>New product</h1>
              <p class="subtitle">Add a product to the catalog</p>
            }
          </div>
        </div>
        @if (product(); as product) {
          <div class="dropdown">
            <button
              class="icon-only"
              type="button"
              aria-haspopup="true"
              [attr.aria-label]="'Actions for ' + product.name"
              [attr.aria-expanded]="menuOpen()"
              (click)="menuOpen.set(!menuOpen())"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <circle cx="8" cy="3" r="1.25" />
                <circle cx="8" cy="8" r="1.25" />
                <circle cx="8" cy="13" r="1.25" />
              </svg>
            </button>
            @if (menuOpen()) {
              <div class="menu below end" role="group" [attr.aria-label]="'Actions for ' + product.name">
                <button class="danger" type="button" (click)="deleteProduct()">
                  Delete
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                    <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.75 7v4M9.25 7v4" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              </div>
            }
          </div>
        }
      </header>
    } @else if (!error() && !api.unreachable() && !notFound()) {
      <p class="muted">Loading product…</p>
    }

    @if (product(); as product) {
      <section class="section" aria-labelledby="stock-heading">
        <h2 id="stock-heading">Stock</h2>
        <p class="reading">
          <span class="scale" [style.--stock]="product.stock"></span>
          {{ product.stock }} in stock
          <span class="status" [attr.data-status]="stockStatus(product.stock)">{{ stockStatus(product.stock) }}</span>
        </p>
        <div class="stock-controls">
          <button class="icon-only" type="button" aria-label="Remove from stock" data-tooltip="Remove from stock" (click)="changeStock('remove')">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M3 8h10" stroke-linecap="round" />
            </svg>
          </button>
          <input type="number" min="1" step="1" aria-label="Quantity" [formControl]="quantity" />
          <button class="icon-only" type="button" aria-label="Add to stock" data-tooltip="Add to stock" (click)="changeStock('add')">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </section>
    }

    @if (product() || isNew()) {
      <section class="section" aria-labelledby="details-heading">
        <h2 id="details-heading">Details</h2>
        <form [formGroup]="form" (ngSubmit)="save()" novalidate>
          <label class="field">
            <span>Name</span>
            <input formControlName="name" />
            @if (invalid('name')) {
              <span class="error">Enter a name of up to 120 characters</span>
            }
          </label>
          <label class="field">
            <span>Description</span>
            <textarea rows="3" formControlName="description"></textarea>
            @if (invalid('description')) {
              <span class="error">Keep the description to 2000 characters</span>
            }
          </label>
          <label class="field">
            <span>Price (€)</span>
            <input inputmode="numeric" placeholder="0,00" formControlName="price" />
            @if (invalid('price')) {
              <span class="error">Enter a price above 0 and up to 1.000.000</span>
            }
          </label>
          @if (isNew()) {
            <label class="field">
              <span>Starting stock</span>
              <input type="number" step="1" formControlName="stock" />
              @if (invalid('stock')) {
                <span class="error">Enter a whole number from 0 to 1,000,000</span>
              }
            </label>
          }
          <div class="field">
            <label for="category">Category</label>
            <app-category-picker formControlName="categoryId" [categories]="categories()" (created)="addCategory($event)" />
            @if (invalid('categoryId')) {
              <span class="error">Choose or create a category</span>
            }
          </div>

          <div class="row">
            <button class="primary" type="submit">
              @if (isNew()) {
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <path d="M8 3v10M3 8h10" stroke-linecap="round" />
                </svg>
                Create product
              } @else {
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <path d="M3 8.5l3.5 3.5L13 4.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                Save changes
              }
            </button>
            <a class="button" routerLink="/products">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
              </svg>
              Cancel
            </a>
            @if (hasChanges()) {
              <span class="unsaved" role="status">Unsaved changes</span>
            }
          </div>
        </form>
      </section>
    }
  `,
})
export class ProductDetail implements OnInit {
  private readonly service = inject(ProductService);
  private readonly router = inject(Router);
  protected readonly api = inject(ApiStatus);
  private readonly confirmation = inject(Confirmation);
  private readonly notice = inject(Notice);

  readonly id = input<string>();
  protected readonly isNew = computed(() => !this.id());

  protected readonly stockStatus = stockStatus;

  protected readonly product = signal<Product | null>(null);
  protected readonly categories = signal<Category[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly notFound = signal(false);
  protected readonly menuOpen = signal(false);

  protected readonly quantity = new FormControl(1, { nonNullable: true });

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    price: new FormControl('', { nonNullable: true, validators: [Validators.required, priceInRange] }),
    stock: new FormControl<number | null>(0, [
      Validators.required,
      Validators.min(0),
      Validators.max(1000000),
      Validators.pattern(/^\d+$/),
    ]),
    categoryId: new FormControl<number | null>(null, [Validators.required]),
  });

  private savedValues = JSON.stringify(this.form.getRawValue());

  constructor() {
    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.load());
    const price = this.form.controls.price;
    price.valueChanges.pipe(takeUntilDestroyed()).subscribe((text) => {
      if (maskPrice(text) !== text) {
        price.setValue(maskPrice(text), { emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.service.getCategories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.api.unreachable.set(false);
      },
      error: (error: HttpErrorResponse) => this.loadFailed(error),
    });
    const id = this.id();
    if (!id) {
      return;
    }
    if (!/^\d+$/.test(id)) {
      this.notFound.set(true);
      return;
    }
    this.service.get(Number(id)).subscribe({
      next: (product) => {
        this.showProduct(product);
        this.notFound.set(false);
        this.loaded();
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 404) {
          this.product.set(null);
          this.notFound.set(true);
          return;
        }
        this.loadFailed(error);
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

  private showProduct(product: Product): void {
    this.product.set(product);
    if (!this.hasChanges()) {
      this.fillForm(product);
    }
  }

  private fillForm(product: Product): void {
    this.form.reset({
      name: product.name,
      description: product.description ?? '',
      price: formatPrice(product.price),
      stock: product.stock,
      categoryId: product.categoryId,
    });
    this.markSaved();
  }

  private markSaved(): void {
    this.savedValues = JSON.stringify(this.form.getRawValue());
  }

  protected hasChanges(): boolean {
    return JSON.stringify(this.form.getRawValue()) !== this.savedValues;
  }

  protected addCategory(category: Category): void {
    this.categories.set([...this.categories(), category]);
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected changeStock(direction: 'add' | 'remove'): void {
    const product = this.product()!;
    const quantity = this.quantity.value;
    if (!Number.isInteger(quantity) || quantity < 1) {
      this.notice.showError('Enter a whole quantity of 1 or more');
      return;
    }
    const request =
      direction === 'add'
        ? this.service.addToStock(product.id, quantity)
        : this.service.decrementStock(product.id, quantity);
    request.subscribe({
      next: (updated) => {
        this.showProduct(updated);
        const text = direction === 'add' ? `Added ${quantity} to stock` : `Removed ${quantity} from stock`;
        this.notice.show(text);
      },
      error: (error: HttpErrorResponse) => this.notice.showError(errorMessage(error)),
    });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const details: ProductInput = {
      name: value.name,
      description: value.description || null,
      price: parsePrice(value.price),
      stock: value.stock!,
      categoryId: value.categoryId!,
    };
    const product = this.product();
    if (!product) {
      this.service.create(details).subscribe({
        next: (created) => {
          this.markSaved();
          this.notice.show(`${created.name} created`);
          this.router.navigate(['/products']);
        },
        error: (error: HttpErrorResponse) => this.notice.showError(errorMessage(error)),
      });
      return;
    }
    this.service.update(product.id, { ...details, stock: product.stock }).subscribe({
      next: (updated) => {
        this.fillForm(updated);
        this.notice.show(`${updated.name} saved`);
        this.router.navigate(['/products']);
      },
      error: (error: HttpErrorResponse) => this.notice.showError(errorMessage(error)),
    });
  }

  canLeave(): boolean | Promise<boolean> {
    return this.hasChanges() ? this.confirmation.askToLeave() : true;
  }

  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasChanges()) {
      event.preventDefault();
    }
  }

  protected closeMenuOnClickOutside(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.dropdown')) {
      this.menuOpen.set(false);
    }
  }

  protected async deleteProduct(): Promise<void> {
    this.menuOpen.set(false);
    const product = this.product()!;
    if (!(await this.confirmation.askToDelete(`"${product.name}"`))) {
      return;
    }
    this.service.delete(product.id).subscribe({
      next: () => {
        this.markSaved();
        this.notice.show(`${product.name} deleted`);
        this.router.navigate(['/products']);
      },
      error: (error: HttpErrorResponse) => this.notice.show(errorMessage(error), true),
    });
  }
}
