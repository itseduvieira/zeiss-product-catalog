import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import {
  Category,
  Product,
  ProductInput,
  ProductService,
  REFRESH_MS,
  errorMessage,
  scaleLevel,
} from './product.service';

/** The result of the last action, shown under the part of the screen it belongs to. */
interface Note {
  text: string;
  error: boolean;
}

/** Detail screen: one product's stock, details and delete. Without an id it creates a product. */
@Component({
  selector: 'app-product-detail',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink],
  template: `
    <nav class="crumbs" aria-label="Breadcrumb"><a routerLink="/products">Product catalog</a></nav>

    @if (loadError()) {
      <p class="error">{{ loadError() }}</p>
    } @else if (id() && !product()) {
      <p class="muted">Loading product…</p>
    }

    @if (product(); as product) {
      <h1>{{ product.name }}</h1>
      <dl class="facts">
        <div><dt>Product number</dt><dd>{{ product.id }}</dd></div>
        <div><dt>Category</dt><dd>{{ product.categoryName }}</dd></div>
        <div><dt>Price</dt><dd>{{ product.price | currency: 'EUR' }}</dd></div>
      </dl>

      <section class="card" aria-labelledby="stock-heading">
        <h2 id="stock-heading">Stock</h2>
        <p class="reading" [class.error]="product.stock === 0">
          {{ product.stock === 0 ? 'Out of stock' : product.stock + ' in stock' }}
        </p>
        <span class="scale large" [style.--level]="scaleLevel(product.stock)"></span>
        <div class="row">
          <button type="button" (click)="changeStock('remove')">Remove</button>
          <input class="short" type="number" min="1" step="1" aria-label="Quantity" [formControl]="quantity" />
          <button type="button" (click)="changeStock('add')">Add</button>
        </div>
        @if (stockNote(); as note) {
          <p class="message" [class.error]="note.error" role="status">{{ note.text }}</p>
        }
      </section>
    } @else if (!id()) {
      <h1>New product</h1>
    }

    @if (product() || !id()) {
      <section class="card" aria-labelledby="details-heading">
        <h2 id="details-heading">Details</h2>
        <form [formGroup]="form" (ngSubmit)="save()" novalidate>
          <label class="field">
            <span>Name</span>
            <input formControlName="name" />
            @if (invalid('name')) {
              <span class="error">Enter a name of up to 120 characters.</span>
            }
          </label>
          <label class="field">
            <span>Description</span>
            <textarea rows="3" formControlName="description"></textarea>
            @if (invalid('description')) {
              <span class="error">Keep the description to 2000 characters.</span>
            }
          </label>
          <label class="field">
            <span>Price in euro</span>
            <input type="number" step="0.01" formControlName="price" />
            @if (invalid('price')) {
              <span class="error">Enter a price above 0 and up to 1,000,000, with at most 2 decimals.</span>
            }
          </label>
          @if (!product()) {
            <label class="field">
              <span>Starting stock</span>
              <input type="number" step="1" formControlName="stock" />
              @if (invalid('stock')) {
                <span class="error">Enter a whole number from 0 to 1,000,000.</span>
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
              <span class="error">Choose a category.</span>
            }
          </label>

          <div class="row">
            <button class="primary" type="submit">{{ product() ? 'Save changes' : 'Create product' }}</button>
            @if (product()) {
              <button class="danger" type="button" (click)="remove()">Delete product</button>
            }
          </div>
          @if (formNote(); as note) {
            <p class="message" [class.error]="note.error" role="status">{{ note.text }}</p>
          }
        </form>
      </section>
    }
  `,
})
export class ProductDetail implements OnInit {
  private readonly service = inject(ProductService);
  private readonly router = inject(Router);

  /** The :id route parameter. Empty on /products/new. */
  readonly id = input<string>();

  protected readonly scaleLevel = scaleLevel;
  protected readonly product = signal<Product | null>(null);
  protected readonly categories = signal<Category[]>([]);
  protected readonly loadError = signal<string | null>(null);
  protected readonly stockNote = signal<Note | null>(null);
  protected readonly formNote = signal<Note | null>(null);

  protected readonly quantity = new FormControl(1, { nonNullable: true });

  // These rules mirror the API's validation.
  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    price: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
      Validators.max(1000000),
      Validators.pattern(/^\d+(\.\d{1,2})?$/),
    ]),
    stock: new FormControl<number | null>(0, [
      Validators.required,
      Validators.min(0),
      Validators.max(1000000),
      Validators.pattern(/^\d+$/),
    ]),
    categoryId: new FormControl<number | null>(null, [Validators.required]),
  });

  constructor() {
    this.service.getCategories().subscribe({
      next: (categories) => this.categories.set(categories),
      error: (error: HttpErrorResponse) => this.loadError.set(errorMessage(error)),
    });
    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.load());
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const id = this.id();
    if (!id) {
      return;
    }
    this.service.get(Number(id)).subscribe({
      next: (product) => this.show(product),
      error: (error: HttpErrorResponse) => this.loadError.set(errorMessage(error)),
    });
  }

  /** Shows the API's copy of the product. The form follows it unless the user has typed in it. */
  private show(product: Product): void {
    this.product.set(product);
    this.loadError.set(null);
    if (!this.form.dirty) {
      this.form.reset({
        name: product.name,
        description: product.description ?? '',
        price: product.price,
        stock: product.stock,
        categoryId: product.categoryId,
      });
    }
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected changeStock(direction: 'add' | 'remove'): void {
    const product = this.product()!;
    const quantity = this.quantity.value;
    if (!Number.isInteger(quantity) || quantity < 1) {
      this.stockNote.set({ text: 'Enter a whole quantity of 1 or more.', error: true });
      return;
    }
    const call =
      direction === 'add'
        ? this.service.addToStock(product.id, quantity)
        : this.service.decrementStock(product.id, quantity);
    call.subscribe({
      next: (updated) => {
        this.show(updated);
        const text = direction === 'add' ? `Added ${quantity} to stock.` : `Removed ${quantity} from stock.`;
        this.stockNote.set({ text, error: false });
      },
      error: (error: HttpErrorResponse) => this.stockNote.set({ text: errorMessage(error), error: true }),
    });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const body: ProductInput = {
      name: value.name,
      description: value.description || null,
      price: value.price!,
      stock: value.stock!,
      categoryId: value.categoryId!,
    };
    const product = this.product();
    if (!product) {
      this.service.create(body).subscribe({
        next: (created) => this.router.navigate(['/products', created.id]),
        error: (error: HttpErrorResponse) => this.formNote.set({ text: errorMessage(error), error: true }),
      });
      return;
    }
    // Stock changes through Add and Remove, so an edit keeps the stock the API holds.
    this.service.update(product.id, { ...body, stock: product.stock }).subscribe({
      next: (updated) => {
        this.form.markAsPristine();
        this.show(updated);
        this.formNote.set({ text: 'Changes saved.', error: false });
      },
      error: (error: HttpErrorResponse) => this.formNote.set({ text: errorMessage(error), error: true }),
    });
  }

  protected remove(): void {
    const product = this.product()!;
    if (!confirm(`Delete "${product.name}"?`)) {
      return;
    }
    this.service.delete(product.id).subscribe({
      next: () => this.router.navigate(['/products']),
      error: (error: HttpErrorResponse) => this.formNote.set({ text: errorMessage(error), error: true }),
    });
  }
}
