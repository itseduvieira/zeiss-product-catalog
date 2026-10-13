import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { Routes, provideRouter, withComponentInputBinding } from '@angular/router';
import { ProductDetail } from './product-detail';
import { ProductList } from './product-list';

const routes: Routes = [
  { path: 'products', component: ProductList, title: 'Product catalog' },
  // Before ':id', so "new" is not read as a product id.
  { path: 'products/new', component: ProductDetail, title: 'New product' },
  { path: 'products/:id', component: ProductDetail, title: 'Product' },
  { path: '**', redirectTo: 'products' },
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    // Route parameters such as :id arrive as component inputs.
    provideRouter(routes, withComponentInputBinding()),
  ],
};
