import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, forwardRef, inject, input, output, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Category, Notice, ProductService, errorMessage } from './product.service';

@Component({
  selector: 'app-category-picker',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CategoryPicker), multi: true }],
  template: `
    <div class="combobox">
      <input
        role="combobox"
        aria-autocomplete="list"
        aria-controls="category-options"
        autocomplete="off"
        placeholder="Search or create a category"
        [id]="inputId()"
        [value]="text()"
        [disabled]="disabled()"
        [attr.aria-expanded]="open()"
        [attr.aria-activedescendant]="open() && optionCount() > 0 ? 'category-option-' + active() : null"
        (input)="type($any($event.target).value)"
        (focus)="open.set(true)"
        (blur)="leave()"
        (keydown)="key($event)"
      />
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      @if (open() && optionCount() > 0) {
        <ul id="category-options" class="menu below listbox" role="listbox" aria-label="Categories">
          @for (category of matches(); track category.id; let index = $index) {
            <li
              role="option"
              [id]="'category-option-' + index"
              [class.active]="index === active()"
              [attr.aria-selected]="category.id === selectedId()"
              (mousedown)="$event.preventDefault()"
              (click)="choose(index)"
            >
              {{ category.name }}
            </li>
          }
          @if (canCreate()) {
            <li
              class="create"
              role="option"
              [id]="'category-option-' + matches().length"
              [class.active]="matches().length === active()"
              aria-selected="false"
              (mousedown)="$event.preventDefault()"
              (click)="choose(matches().length)"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path d="M8 3v10M3 8h10" stroke-linecap="round" />
              </svg>
              Create "{{ typed() }}"
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class CategoryPicker implements ControlValueAccessor {
  private readonly service = inject(ProductService);
  private readonly notice = inject(Notice);

  readonly categories = input<Category[]>([]);
  readonly inputId = input('category');
  readonly created = output<Category>();

  protected readonly selectedId = signal<number | null>(null);
  protected readonly query = signal<string | null>(null);
  protected readonly open = signal(false);
  protected readonly active = signal(0);
  protected readonly disabled = signal(false);

  protected readonly typed = computed(() => (this.query() ?? '').trim());

  protected readonly text = computed(
    () => this.query() ?? this.categories().find((c) => c.id === this.selectedId())?.name ?? '',
  );

  protected readonly matches = computed(() =>
    this.categories()
      .filter((c) => c.name.toLowerCase().includes(this.typed().toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  protected readonly canCreate = computed(
    () => this.typed() !== '' && !this.categories().some((c) => c.name.toLowerCase() === this.typed().toLowerCase()),
  );

  protected readonly optionCount = computed(() => this.matches().length + (this.canCreate() ? 1 : 0));

  private onChange: (id: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(id: number | null): void {
    this.selectedId.set(id);
    this.query.set(null);
  }

  registerOnChange(fn: (id: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected type(text: string): void {
    this.query.set(text);
    this.open.set(true);
    this.active.set(0);
    const exact = this.categories().find((c) => c.name.toLowerCase() === text.trim().toLowerCase());
    this.select(exact?.id ?? null);
  }

  protected choose(index: number): void {
    const category = this.matches()[index];
    if (category) {
      this.select(category.id);
      this.query.set(null);
      this.open.set(false);
      return;
    }
    this.create();
  }

  protected leave(): void {
    this.open.set(false);
    this.onTouched();
    if (this.selectedId() !== null) {
      this.query.set(null);
    }
  }

  protected key(event: KeyboardEvent): void {
    const count = this.optionCount();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.open.set(true);
      if (count > 0) {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.active.set((this.active() + step + count) % count);
      }
    } else if (event.key === 'Enter' && this.open() && count > 0) {
      event.preventDefault();
      this.choose(this.active());
    } else if (event.key === 'Escape') {
      this.open.set(false);
    }
  }

  private select(id: number | null): void {
    if (id !== this.selectedId()) {
      this.selectedId.set(id);
      this.onChange(id);
    }
  }

  private create(): void {
    this.service.createCategory({ name: this.typed(), description: '' }).subscribe({
      next: (category) => {
        this.created.emit(category);
        this.select(category.id);
        this.query.set(null);
        this.open.set(false);
      },
      error: (error: HttpErrorResponse) => this.notice.showError(errorMessage(error)),
    });
  }
}
