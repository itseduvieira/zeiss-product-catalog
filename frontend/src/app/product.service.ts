import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
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

/** The stock scale has 20 graduations. Larger stock fills it. */
export function scaleLevel(stock: number): number {
  return Math.min(stock, 20);
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
  // No answer from the API: status 0 in a browser, 502 or 504 from the dev proxy.
  return [0, 502, 503, 504].includes(error.status) ? 'The API is not reachable.' : error.message;
}
