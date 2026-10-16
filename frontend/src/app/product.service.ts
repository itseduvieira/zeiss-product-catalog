import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../environments/environment';

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  categoryId: number;
  categoryName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  name: string;
  description: string | null;
  price: number;
  stock: number;
  categoryId: number;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  productCount: number;
  isUncategorized: boolean;
}

export interface CategoryInput {
  name: string;
  description: string;
}

export const REFRESH_MS = 15000;

export type StockStatus = 'In Stock' | 'Low' | 'Critical' | 'Out of Stock';

export const STOCK_STATUSES: StockStatus[] = ['In Stock', 'Low', 'Critical', 'Out of Stock'];

export function formatPrice(price: number): string {
  const [euros, cents] = price.toFixed(2).split('.');
  const groups: string[] = [];
  for (let end = euros.length; end > 0; end -= 3) {
    groups.unshift(euros.slice(Math.max(0, end - 3), end));
  }
  return `${groups.join('.')},${cents}`;
}

export function stockStatus(stock: number): StockStatus {
  if (stock === 0) {
    return 'Out of Stock';
  }
  if (stock <= 3) {
    return 'Critical';
  }
  if (stock <= 9) {
    return 'Low';
  }
  return 'In Stock';
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/products`;
  private readonly categoriesUrl = `${environment.apiUrl}/api/categories`;

  getAll() {
    return this.http.get<Product[]>(this.url);
  }

  get(id: number) {
    return this.http.get<Product>(`${this.url}/${id}`);
  }

  create(product: ProductInput) {
    return this.http.post<Product>(this.url, product);
  }

  update(id: number, product: ProductInput) {
    return this.http.put<Product>(`${this.url}/${id}`, product);
  }

  delete(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  decrementStock(id: number, quantity: number) {
    return this.http.post<Product>(`${this.url}/${id}/decrement-stock/${quantity}`, null);
  }

  addToStock(id: number, quantity: number) {
    return this.http.post<Product>(`${this.url}/${id}/add-to-stock/${quantity}`, null);
  }

  search(name: string) {
    return this.http.get<Product[]>(`${this.url}/search`, { params: { name } });
  }

  getByStockLevel(min: number, max: number) {
    return this.http.get<Product[]>(`${this.url}/stock-level`, { params: { min, max } });
  }

  getCategories() {
    return this.http.get<Category[]>(this.categoriesUrl);
  }

  getCategory(id: number) {
    return this.http.get<Category>(`${this.categoriesUrl}/${id}`);
  }

  createCategory(category: CategoryInput) {
    return this.http.post<Category>(this.categoriesUrl, category);
  }

  updateCategory(id: number, category: CategoryInput) {
    return this.http.put<Category>(`${this.categoriesUrl}/${id}`, category);
  }

  deleteCategory(id: number, moveProducts = false) {
    return this.http.delete<void>(`${this.categoriesUrl}/${id}`, { params: { moveProducts } });
  }
}

@Injectable({ providedIn: 'root' })
export class ApiStatus {
  readonly unreachable = signal(false);
}

export interface Question {
  title: string;
  text: string;
  action: string;
}

@Injectable({ providedIn: 'root' })
export class Confirmation {
  readonly question = signal<Question | null>(null);
  private resolve?: (confirmed: boolean) => void;

  askToDelete(what: string, movedProducts = 0): Promise<boolean> {
    if (movedProducts > 0) {
      const products = movedProducts === 1 ? '1 product moves' : `${movedProducts} products move`;
      return this.ask({ title: `Delete ${what}?`, text: `${products} to Uncategorized`, action: 'Move and delete' });
    }
    return this.ask({ title: `Delete ${what}?`, text: 'This cannot be undone', action: 'Delete' });
  }

  askToLeave(): Promise<boolean> {
    return this.ask({ title: 'Leave without saving?', text: 'Your changes will be lost', action: 'Leave' });
  }

  answer(confirmed: boolean): void {
    this.question.set(null);
    this.resolve?.(confirmed);
    this.resolve = undefined;
  }

  private ask(question: Question): Promise<boolean> {
    this.question.set(question);
    return new Promise((resolve) => (this.resolve = resolve));
  }
}

export interface NoticeAction {
  label: string;
  run: () => void;
}

export interface NoticeMessage {
  text: string;
  error: boolean;
  action?: NoticeAction;
}

@Injectable({ providedIn: 'root' })
export class Notice {
  readonly message = signal<NoticeMessage | null>(null);
  readonly text = computed(() => this.message()?.text ?? null);
  private timer?: ReturnType<typeof setTimeout>;

  show(text: string, error = false): void {
    this.open({ text, error });
    this.timer = setTimeout(() => this.close(), error ? 6000 : 4000);
  }

  showError(text: string, action?: NoticeAction): void {
    this.open({ text, error: true, action });
  }

  close(): void {
    clearTimeout(this.timer);
    this.message.set(null);
  }

  private open(message: NoticeMessage): void {
    clearTimeout(this.timer);
    this.message.set(message);
  }
}

export function deletedText(what: string, movedProducts: number): string {
  if (movedProducts === 0) {
    return `${what} deleted`;
  }
  const products = movedProducts === 1 ? '1 product' : `${movedProducts} products`;
  return `${what} deleted, ${products} moved to Uncategorized`;
}

export function isUnreachable(error: HttpErrorResponse): boolean {
  return [0, 502, 503, 504].includes(error.status) && !error.error?.detail && !error.error?.errors;
}

export function errorMessage(error: HttpErrorResponse): string {
  const fieldErrors = error.error?.errors as Record<string, string[]> | undefined;
  if (fieldErrors) {
    return Object.values(fieldErrors).flat().join(' ');
  }
  if (error.error?.detail) {
    return error.error.detail;
  }
  if (isUnreachable(error)) {
    return 'The API is not reachable';
  }
  return `Something went wrong: ${error.status} ${error.statusText}`.trim();
}
