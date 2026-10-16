import { Component, ElementRef, afterRenderEffect, inject, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiStatus, Confirmation, Notice, NoticeAction } from './product.service';

@Component({
  selector: 'app-root',
  host: { '(document:click)': 'closeMenuOnClickOutside($event)', '(document:keydown.escape)': 'menuOpen.set(false)' },
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <header class="bar">
      <a class="brand" routerLink="/products" (click)="menuOpen.set(false)">
        <img src="zeiss-logo.svg" alt="" width="40" height="40" />
        Zeiss Vision
      </a>
      <button
        class="menu-button"
        type="button"
        aria-label="Menu"
        aria-controls="main-menu"
        [attr.aria-expanded]="menuOpen()"
        (click)="menuOpen.set(!menuOpen())"
      >
        @if (menuOpen()) {
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke-linecap="round" />
          </svg>
        } @else {
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" stroke-linecap="round" />
          </svg>
        }
      </button>
      <nav id="main-menu" class="nav" [class.open]="menuOpen()" aria-label="Main">
        <a routerLink="/products" routerLinkActive="active" ariaCurrentWhenActive="page" (click)="menuOpen.set(false)">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">
            <path d="M10 2l7 3.5v9L10 18l-7-3.5v-9L10 2z" />
            <path d="M3 5.5L10 9l7-3.5M10 9v9" />
          </svg>
          Catalog
        </a>
        <a routerLink="/categories" routerLinkActive="active" ariaCurrentWhenActive="page" (click)="menuOpen.set(false)">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 3h7l7 7-7 7-7-7V3z" />
            <circle cx="7" cy="7" r="1.25" />
          </svg>
          Categories
        </a>
      </nav>
    </header>
    @if (api.unreachable()) {
      <div class="ribbon" role="alert">
        The API is not reachable
        <button class="link" type="button" (click)="reload()">Try again</button>
      </div>
    }
    <main class="page">
      <router-outlet />
    </main>
    <footer class="bar">
      <p>Carl Zeiss Vision assessment</p>
    </footer>

    <div class="toast-region" role="status">
      @if (notice.message(); as message) {
        <div class="toast" [class.error]="message.error">
          @if (message.error) {
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <circle cx="9" cy="9" r="7.25" />
              <path d="M9 5.5v4.25" stroke-linecap="round" />
              <circle cx="9" cy="12.5" r="0.5" fill="currentColor" />
            </svg>
          } @else {
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <circle cx="9" cy="9" r="7.25" />
              <path d="M5.75 9.25l2.25 2.25 4.25-4.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          }
          <span>{{ message.text }}</span>
          @if (message.action; as action) {
            <button class="link" type="button" (click)="run(action)">{{ action.label }}</button>
          }
          <button class="toast-close" type="button" aria-label="Close message" (click)="notice.close()">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      }
    </div>

    <dialog #dialog aria-labelledby="dialog-title" aria-describedby="dialog-text" (close)="confirmation.answer(false)">
      <h2 id="dialog-title">{{ confirmation.question()?.title }}</h2>
      <p id="dialog-text">{{ confirmation.question()?.text }}</p>
      <div class="row">
        <button type="button" autofocus (click)="confirmation.answer(false)">Cancel</button>
        <button class="danger" type="button" (click)="confirmation.answer(true)">{{ confirmation.question()?.action }}</button>
      </div>
    </dialog>
  `,
})
export class App {
  protected readonly api = inject(ApiStatus);
  protected readonly confirmation = inject(Confirmation);
  protected readonly notice = inject(Notice);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly menuOpen = signal(false);

  constructor() {
    afterRenderEffect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.confirmation.question() && !dialog.open) {
        dialog.showModal();
      }
      if (!this.confirmation.question() && dialog.open) {
        dialog.close();
      }
    });
  }

  protected closeMenuOnClickOutside(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('header')) {
      this.menuOpen.set(false);
    }
  }

  protected run(action: NoticeAction): void {
    this.notice.close();
    action.run();
  }

  protected reload(): void {
    location.reload();
  }
}
