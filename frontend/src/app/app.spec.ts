import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { Notice } from './product.service';

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let page: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([{ path: '**', children: [] }])] }).compileComponents();
    fixture = TestBed.createComponent(App);
    page = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('has a header menu with Catalog and Categories', () => {
    const links = Array.from(page.querySelectorAll('nav a')).map((a) => [a.textContent?.trim(), a.getAttribute('href')]);

    expect(links).toEqual([
      ['Catalog', '/products'],
      ['Categories', '/categories'],
    ]);
  });

  it('shows a success message from Notice', async () => {
    TestBed.inject(Notice).show('Primo Star saved');
    await fixture.whenStable();

    expect(page.querySelector('.toast')?.textContent?.trim()).toBe('Primo Star saved');
  });

  it('shows an error with its action and a close button, and the action closes it before it runs', async () => {
    const notice = TestBed.inject(Notice);
    const run = vi.fn();
    notice.showError('The database is busy.', { label: 'Try again', run });
    await fixture.whenStable();

    const toast = page.querySelector('.toast.error')!;
    expect(toast.querySelector('span')?.textContent).toBe('The database is busy.');
    expect(toast.querySelector('button[aria-label="Close message"]')).not.toBeNull();

    Array.from(toast.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Try again')!.click();
    await fixture.whenStable();

    expect(run).toHaveBeenCalled();
    expect(page.querySelector('.toast')).toBeNull();
  });

  it('opens the menu from the menu button, and closes it on Escape or on a choice', async () => {
    const menuButton = page.querySelector<HTMLButtonElement>('button[aria-label="Menu"]')!;
    const nav = page.querySelector('nav')!;

    menuButton.click();
    await fixture.whenStable();
    expect(menuButton.getAttribute('aria-expanded')).toBe('true');
    expect(nav.classList).toContain('open');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(nav.classList).not.toContain('open');

    menuButton.click();
    await fixture.whenStable();
    nav.querySelector<HTMLAnchorElement>('a')!.click();
    await fixture.whenStable();
    expect(menuButton.getAttribute('aria-expanded')).toBe('false');
  });
});
