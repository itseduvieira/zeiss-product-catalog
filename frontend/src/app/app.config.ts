import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { CanDeactivateFn, Routes, provideRouter, withComponentInputBinding } from '@angular/router';
import { ProductDetail } from './product-detail';
import { ProductList } from './product-list';

const confirmLeave: CanDeactivateFn<ProductDetail> = (screen) => screen.canLeave();

const routes: Routes = [
  { path: 'products', component: ProductList, title: 'Product catalog' },
  { path: 'products/new', component: ProductDetail, title: 'New product', canDeactivate: [confirmLeave] },
  { path: 'products/:id', component: ProductDetail, title: 'Product', canDeactivate: [confirmLeave] },
  { path: '**', redirectTo: 'products' },
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes, withComponentInputBinding()),
  ],
};
