import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
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

/** The body for create and update. */
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
}

/** How often a screen asks the API again, so changes made elsewhere show up. */
export const REFRESH_MS = 15000;

/** How full a product's stock is. It is the badge text, and styles.scss picks the badge color from it. */
export type StockStatus = 'In Stock' | 'Low' | 'Critical' | 'Out of Stock';

/** The statuses in the order the Status filter lists them. */
export const STOCK_STATUSES: StockStatus[] = ['In Stock', 'Low', 'Critical', 'Out of Stock'];

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
    return this.http.get<Category[]>(`${environment.apiUrl}/api/categories`);
  }
}

/** Whether the API answers. The screens set it, and the frame shows a red ribbon under the header while it is true. */
@Injectable({ providedIn: 'root' })
export class ApiStatus {
  readonly unreachable = signal(false);
}

/** A question for the confirmation dialog: its title, one line under it, and the label of the red button. */
export interface Question {
  title: string;
  text: string;
  action: string;
}

/**
 * Asks the user to confirm in a dialog, such as before a delete. A screen awaits the answer;
 * the frame shows the dialog and calls answer() with the button the user pressed.
 */
@Injectable({ providedIn: 'root' })
export class Confirmation {
  /** The open question, or null while the dialog is closed. */
  readonly question = signal<Question | null>(null);
  private resolve?: (confirmed: boolean) => void;

  /** "what" is the product name in quotes, or a count such as 2 products. */
  askToDelete(what: string): Promise<boolean> {
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

/** No answer from the API: status 0 in a browser, or 502, 503, or 504 from a proxy, without problem details. */
export function isUnreachable(error: HttpErrorResponse): boolean {
  return [0, 502, 503, 504].includes(error.status) && !error.error?.detail && !error.error?.errors;
}

/** Turns a failed API call into text for the user. */
export function errorMessage(error: HttpErrorResponse): string {
  // The API sends field errors as { errors: { field: ["message"] } }, and other errors as { detail }.
  const fieldErrors = error.error?.errors as Record<string, string[]> | undefined;
  if (fieldErrors) {
    return Object.values(fieldErrors).flat().join(' ');
  }
  if (error.error?.detail) {
    return error.error.detail;
  }
  return isUnreachable(error) ? 'The API is not reachable' : error.message;
}
