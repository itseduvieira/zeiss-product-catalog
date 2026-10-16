import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <section class="empty-state" aria-labelledby="not-found-title">
      <svg width="48" height="48" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="7.5" />
        <path d="M17.5 17.5L24 24M9.5 9.5l5 5M14.5 9.5l-5 5" />
      </svg>
      <h1 id="not-found-title">{{ title() ?? 'Page not found' }}</h1>
      <p class="muted">{{ message() ?? 'The page you are looking for does not exist or has moved' }}</p>
      <a class="button primary" routerLink="/products">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">
          <path d="M10 2l7 3.5v9L10 18l-7-3.5v-9L10 2z" />
          <path d="M3 5.5L10 9l7-3.5M10 9v9" />
        </svg>
        Go to catalog
      </a>
    </section>
  `,
})
export class NotFound {
  readonly title = input<string>();
  readonly message = input<string>();
}
