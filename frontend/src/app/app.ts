import { Component, ElementRef, afterRenderEffect, inject, viewChild } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ApiStatus, Confirmation } from './product.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  template: `
    <header class="bar">
      <a class="brand" routerLink="/products">
        <img src="zeiss-logo.svg" alt="" width="40" height="40" />
        Zeiss Vision
      </a>
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
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

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

  protected reload(): void {
    location.reload();
  }
}
