import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

/** The page frame: header, the current screen, footer. */
@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  template: `
    <header class="bar">
      <a class="brand" routerLink="/products">
        <!-- Empty alt: the link text already names it, so a screen reader does not say "ZEISS" twice -->
        <img src="zeiss-logo.svg" alt="" width="40" height="40" />
        Zeiss Vision
      </a>
    </header>
    <main class="page">
      <router-outlet />
    </main>
    <footer class="bar">
      <p>Carl Zeiss Vision assessment</p>
    </footer>
  `,
})
export class App {}
