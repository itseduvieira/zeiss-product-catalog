import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import { NotFound } from './not-found';
import { ApiStatus, Category, CategoryInput, Confirmation, Notice, ProductService, REFRESH_MS, deletedText, errorMessage, isUnreachable } from './product.service';

@Component({
  selector: 'app-category-detail',
  host: {
    '(document:click)': 'closeMenuOnClickOutside($event)',
    '(document:keydown.escape)': 'menuOpen.set(false)',
    '(window:beforeunload)': 'warnBeforeUnload($event)',
  },
  imports: [NotFound, ReactiveFormsModule, RouterLink],
  template: `
    @if (notFound()) {
      <app-not-found title="Category not found" [message]="'There is no category ' + id() + ' in the catalog'" />
    }

    @if (category() || isNew()) {
      <header class="page-header">
        <div class="row">
          <span class="icon-tile" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
              <path d="M3 3h7l7 7-7 7-7-7V3z" />
              <circle cx="7" cy="7" r="1.25" />
            </svg>
          </span>
          <div class="title">
            @if (category(); as category) {
              <h1>{{ category.name }}</h1>
              <p class="subtitle">{{ category.productCount }} {{ category.productCount === 1 ? 'product' : 'products' }}</p>
            } @else {
              <h1>New category</h1>
              <p class="subtitle">Add a category to the catalog</p>
            }
          </div>
        </div>
        @if (category(); as category) {
          @if (!category.isUncategorized) {
            <div class="dropdown">
              <button class="icon-only" type="button" aria-haspopup="true" [attr.aria-label]="'Actions for ' + category.name" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(!menuOpen())">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <circle cx="8" cy="3" r="1.25" />
                  <circle cx="8" cy="8" r="1.25" />
                  <circle cx="8" cy="13" r="1.25" />
                </svg>
              </button>
              @if (menuOpen()) {
                <div class="menu below end" role="group" [attr.aria-label]="'Actions for ' + category.name">
                  <button class="danger" type="button" (click)="deleteCategory()">
                    Delete
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                      <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.75 7v4M9.25 7v4" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                </div>
              }
            </div>
          }
        }
      </header>
    } @else if (!error() && !api.unreachable() && !notFound()) {
      <p class="muted">Loading category…</p>
    }

    @if (category() || isNew()) {
      <section class="section" aria-labelledby="details-heading">
        <h2 id="details-heading">Details</h2>
        <form [formGroup]="form" (ngSubmit)="save()" novalidate>
          <label class="field">
            <span>Name</span>
            <input formControlName="name" [readonly]="category()?.isUncategorized" />
            @if (invalid('name')) {
              <span class="error">Enter a name of up to 80 characters</span>
            }
          </label>
          <label class="field">
            <span>Description</span>
            <textarea rows="3" formControlName="description"></textarea>
            @if (invalid('description')) {
              <span class="error">Keep the description to 400 characters</span>
            }
          </label>

          <div class="row">
            <button class="primary" type="submit">
              @if (isNew()) {
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <path d="M8 3v10M3 8h10" stroke-linecap="round" />
                </svg>
                Create category
              } @else {
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <path d="M3 8.5l3.5 3.5L13 4.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                Save changes
              }
            </button>
            <a class="button" routerLink="/categories">
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
export class CategoryDetail implements OnInit {
  private readonly service = inject(ProductService);
  private readonly router = inject(Router);
  protected readonly api = inject(ApiStatus);
  private readonly confirmation = inject(Confirmation);
  private readonly notice = inject(Notice);

  readonly id = input<string>();
  protected readonly isNew = computed(() => !this.id());

  protected readonly category = signal<Category | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notFound = signal(false);
  protected readonly menuOpen = signal(false);

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(400)],
    }),
  });

  private savedValues = JSON.stringify(this.form.getRawValue());

  constructor() {
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
    if (!/^\d+$/.test(id)) {
      this.notFound.set(true);
      return;
    }
    this.service.getCategory(Number(id)).subscribe({
      next: (category) => {
        this.showCategory(category);
        this.notFound.set(false);
        this.loaded();
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 404) {
          this.category.set(null);
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

  private showCategory(category: Category): void {
    this.category.set(category);
    if (!this.hasChanges()) {
      this.fillForm(category);
    }
  }

  private fillForm(category: Category): void {
    this.form.reset({ name: category.name, description: category.description });
    this.markSaved();
  }

  private markSaved(): void {
    this.savedValues = JSON.stringify(this.form.getRawValue());
  }

  protected hasChanges(): boolean {
    return JSON.stringify(this.form.getRawValue()) !== this.savedValues;
  }

  protected invalid(name: 'name' | 'description'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const details: CategoryInput = {
      name: value.name.trim(),
      description: value.description.trim(),
    };
    const category = this.category();
    if (!category) {
      this.service.createCategory(details).subscribe({
        next: (created) => {
          this.markSaved();
          this.notice.show(`${created.name} created`);
          this.router.navigate(['/categories']);
        },
        error: (error: HttpErrorResponse) => this.notice.showError(errorMessage(error)),
      });
      return;
    }
    this.service.updateCategory(category.id, details).subscribe({
      next: (updated) => {
        this.fillForm(updated);
        this.notice.show(`${updated.name} saved`);
        this.router.navigate(['/categories']);
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

  protected async deleteCategory(): Promise<void> {
    this.menuOpen.set(false);
    const category = this.category()!;
    if (!(await this.confirmation.askToDelete(`"${category.name}"`, category.productCount))) {
      return;
    }
    this.service.deleteCategory(category.id, category.productCount > 0).subscribe({
      next: () => {
        this.markSaved();
        this.notice.show(deletedText(category.name, category.productCount));
        this.router.navigate(['/categories']);
      },
      error: (error: HttpErrorResponse) => this.notice.show(errorMessage(error), true),
    });
  }
}
