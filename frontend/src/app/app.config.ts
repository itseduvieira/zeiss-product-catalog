import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { CanDeactivateFn, Routes, provideRouter, withComponentInputBinding } from '@angular/router';
import { CategoryDetail } from './category-detail';
import { CategoryList } from './category-list';
import { NotFound } from './not-found';
import { ProductDetail } from './product-detail';
import { ProductList } from './product-list';

const confirmLeave: CanDeactivateFn<{ canLeave(): boolean | Promise<boolean> }> = (page) => page.canLeave();

const routes: Routes = [
  { path: 'products', component: ProductList, title: 'Product catalog' },
  { path: 'products/new', component: ProductDetail, title: 'New product', canDeactivate: [confirmLeave] },
  { path: 'products/:id', component: ProductDetail, title: 'Product', canDeactivate: [confirmLeave] },
  { path: 'categories', component: CategoryList, title: 'Categories' },
  { path: 'categories/new', component: CategoryDetail, title: 'New category', canDeactivate: [confirmLeave] },
  { path: 'categories/:id', component: CategoryDetail, title: 'Category', canDeactivate: [confirmLeave] },
  { path: '', redirectTo: 'products', pathMatch: 'full' },
  { path: '**', component: NotFound, title: 'Page not found' },
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes, withComponentInputBinding()),
  ],
};
