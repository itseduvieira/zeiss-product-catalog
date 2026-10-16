import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NotFound } from './not-found';

describe('NotFound', () => {
  it('says the page was not found, with a button back to the catalog, when the router opens it', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: NotFound }], withComponentInputBinding())],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/nothing-here');
    const page = harness.routeNativeElement!;

    expect(page.querySelector('h1')?.textContent).toBe('Page not found');
    expect(page.querySelector('p')?.textContent).toBe('The page you are looking for does not exist or has moved');
    const button = page.querySelector('a.button');
    expect(button?.textContent?.trim()).toBe('Go to catalog');
    expect(button?.getAttribute('href')).toBe('/products');
  });
});
