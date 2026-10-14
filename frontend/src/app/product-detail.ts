import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import {
  ApiStatus,
  Category,
  Confirmation,
  Product,
  ProductInput,
  ProductService,
  REFRESH_MS,
  errorMessage,
  isUnreachable,
  stockStatus,
} from './product.service';

/** The result of the last action, shown under the part of the screen it belongs to. */
interface Message {
  text: string;
  error: boolean;
}

/** A price as the price box shows it: 2,450.00. */
export function formatPrice(price: number): string {
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** The price in a text such as 2,450.00. */
export function parsePrice(text: string): number {
  return Number(text.replace(/,/g, ''));
}

/**
 * The mask of the price box. The digits typed so far are read as cents, like a till, so typing 2 4 5 0 0 0
 * shows 0.02, 0.24, 2.45, 24.50, 245.00, then 2,450.00. Anything else typed is dropped.
 */
export function maskPrice(text: string): string {
  const digits = text.replace(/\D/g, '');
  return digits === '' ? '' : formatPrice(Number(digits) / 100);
}

/** The API takes a price above 0 and up to 1,000,000. */
function priceInRange(control: AbstractControl<string>): ValidationErrors | null {
  const price = parsePrice(control.value);
  return control.value === '' || (price > 0 && price <= 1000000) ? null : { priceRange: true };
}

/** Detail screen: one product's stock and details. Without an id it creates a product. */
@Component({
  selector: 'app-product-detail',
  host: {
    // The actions menu closes on a click outside it or on Escape, like the menus on the list.
    '(document:click)': 'closeMenuOnClickOutside($event)',
    '(document:keydown.escape)': 'menuOpen.set(false)',
    '(window:beforeunload)': 'warnBeforeUnload($event)',
  },
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    @if (error()) {
      <p class="error">{{ error() }} <button type="button" (click)="load()">Try again</button></p>
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
    } @else if (!error() && !api.unreachable()) {
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
        @if (stockMessage(); as message) {
          <p class="message" [class.error]="message.error" role="status">{{ message.text }}</p>
        }
      </section>
    }

    @if (product() || isNew()) {
      <section class="section" aria-labelledby="details-heading">
        <h2 id="details-heading">Details</h2>
        <!-- Typing clears the last save's result, so "Changes saved" never sits next to new changes -->
        <form [formGroup]="form" (ngSubmit)="save()" (input)="formMessage.set(null)" novalidate>
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
            <!-- Text with a mask, not a number box, so the price reads 2,450.00 while typing -->
            <input inputmode="numeric" placeholder="0.00" formControlName="price" />
            @if (invalid('price')) {
              <span class="error">Enter a price above 0 and up to 1,000,000</span>
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
          <label class="field">
            <span>Category</span>
            <select formControlName="categoryId">
              <option [ngValue]="null" disabled>Choose a category</option>
              @for (category of categories(); track category.id) {
                <option [ngValue]="category.id">{{ category.name }}</option>
              }
            </select>
            @if (invalid('categoryId')) {
              <span class="error">Choose a category</span>
            }
          </label>

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
            <!-- Cancel leaves without saving: back to the list -->
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
          @if (formMessage(); as message) {
            <p class="message" [class.error]="message.error" role="status">{{ message.text }}</p>
          }
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

  /** The :id route parameter. Empty on /products/new. */
  readonly id = input<string>();
  /** True on /products/new, where the screen creates a product. */
  protected readonly isNew = computed(() => !this.id());

  protected readonly stockStatus = stockStatus;

  /** What the API returned for this product, or null on /products/new and until it arrives. */
  protected readonly product = signal<Product | null>(null);
  protected readonly categories = signal<Category[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly stockMessage = signal<Message | null>(null);
  protected readonly formMessage = signal<Message | null>(null);
  /** Whether the ⋮ menu in the header is open. */
  protected readonly menuOpen = signal(false);

  /** How many units Remove and Add take away or put in. */
  protected readonly quantity = new FormControl(1, { nonNullable: true });

  // These rules mirror the API's validation.
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

  /**
   * The form's values when it last matched the saved product, or the empty form on /products/new.
   * The form has unsaved changes while it differs from these, so undoing a change also undoes the notice.
   */
  private savedValues = JSON.stringify(this.form.getRawValue());

  constructor() {
    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.load());
    // The mask: whatever is typed in the price box is shown again as 0,000.00.
    const price = this.form.controls.price;
    price.valueChanges.pipe(takeUntilDestroyed()).subscribe((text) => {
      if (maskPrice(text) !== text) {
        price.setValue(maskPrice(text), { emitEvent: false });
      }
    });
  }

  // The id input is set from here on, not yet in the constructor.
  ngOnInit(): void {
    this.load();
  }

  /** Loads the categories for the form and, unless the product is new, the product. */
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
    this.service.get(Number(id)).subscribe({
      next: (product) => {
        this.showProduct(product);
        this.error.set(null);
        this.api.unreachable.set(false);
      },
      error: (error: HttpErrorResponse) => this.loadFailed(error),
    });
  }

  private loadFailed(error: HttpErrorResponse): void {
    // An unreachable API shows in the ribbon under the header; other errors show here.
    this.api.unreachable.set(isUnreachable(error));
    this.error.set(isUnreachable(error) ? null : errorMessage(error));
  }

  /** Shows the API's copy of the product. The form follows it, unless it has changes the user has not saved. */
  private showProduct(product: Product): void {
    this.product.set(product);
    if (!this.hasChanges()) {
      this.fillForm(product);
    }
  }

  /** Puts the product in the form, as its saved values. */
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

  /** Takes what the form shows now as saved, so it has no unsaved changes. */
  private markSaved(): void {
    this.savedValues = JSON.stringify(this.form.getRawValue());
  }

  /** Whether the form differs from the saved product. Shows Unsaved changes, and makes leaving ask first. */
  protected hasChanges(): boolean {
    return JSON.stringify(this.form.getRawValue()) !== this.savedValues;
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  /** Removes or adds the typed quantity. The API refuses to take stock below zero. */
  protected changeStock(direction: 'add' | 'remove'): void {
    const product = this.product()!;
    const quantity = this.quantity.value;
    if (!Number.isInteger(quantity) || quantity < 1) {
      this.stockMessage.set({ text: 'Enter a whole quantity of 1 or more', error: true });
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
        this.stockMessage.set({ text, error: false });
      },
      error: (error: HttpErrorResponse) => this.stockMessage.set({ text: errorMessage(error), error: true }),
    });
  }

  /** Creates the product and opens its screen, or saves the changes to it. */
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
          // Saved, so opening the new product's screen does not ask about leaving unsaved changes.
          this.markSaved();
          this.router.navigate(['/products', created.id]);
        },
        error: (error: HttpErrorResponse) => this.formMessage.set({ text: errorMessage(error), error: true }),
      });
      return;
    }
    // Stock changes through Add and Remove, so an edit keeps the stock the API holds.
    this.service.update(product.id, { ...details, stock: product.stock }).subscribe({
      next: (updated) => {
        this.product.set(updated);
        this.fillForm(updated);
        this.formMessage.set({ text: 'Changes saved', error: false });
      },
      error: (error: HttpErrorResponse) => this.formMessage.set({ text: errorMessage(error), error: true }),
    });
  }

  /**
   * Asked by the router before it leaves this screen, such as on Cancel. With unsaved changes,
   * the user decides in the confirmation dialog.
   */
  canLeave(): boolean | Promise<boolean> {
    return this.hasChanges() ? this.confirmation.askToLeave() : true;
  }

  /** Reloading or closing the tab with unsaved changes makes the browser ask first, in its own words. */
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

  /** Deletes the product after a confirmation, then goes back to the list. */
  protected async deleteProduct(): Promise<void> {
    this.menuOpen.set(false);
    const product = this.product()!;
    if (!(await this.confirmation.askToDelete(`"${product.name}"`))) {
      return;
    }
    this.service.delete(product.id).subscribe({
      next: () => {
        // The product is gone, so there is nothing left to save.
        this.markSaved();
        this.router.navigate(['/products']);
      },
      error: (error: HttpErrorResponse) => this.error.set(errorMessage(error)),
    });
  }
}
