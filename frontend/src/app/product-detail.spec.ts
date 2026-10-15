import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ProductDetail, maskPrice } from './product-detail';
import { Confirmation, Product, ProductService } from './product.service';

const product: Product = {
  id: 100001,
  name: 'Primo Star',
  description: 'Upright microscope',
  price: 2450,
  stock: 6,
  categoryId: 1,
  categoryName: 'Microscopes',
  createdAt: '2024-06-01T08:00:00Z',
  updatedAt: '2024-06-01T08:00:00Z',
};

describe('ProductDetail', () => {
  const service = {
    get: vi.fn(() => of(product)),
    getCategories: vi.fn(() => of([{ id: 1, name: 'Microscopes', description: '' }])),
    addToStock: vi.fn(() => of({ ...product, stock: 9 })),
    update: vi.fn(() => of(product)),
    delete: vi.fn(() => of(undefined)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ProductDetail],
      providers: [provideRouter([]), { provide: ProductService, useValue: service }],
    }).compileComponents();
  });

  async function render(id?: string) {
    const fixture = TestBed.createComponent(ProductDetail);
    if (id) {
      fixture.componentRef.setInput('id', id);
    }
    await fixture.whenStable();
    return fixture;
  }

  async function deleteFromMenu(fixture: Awaited<ReturnType<typeof render>>) {
    const page = fixture.nativeElement as HTMLElement;
    page.querySelector<HTMLButtonElement>('button[aria-label="Actions for Primo Star"]')!.click();
    await fixture.whenStable();
    page.querySelector<HTMLButtonElement>('.menu button.danger')!.click();
    await fixture.whenStable();
  }

  function button(page: HTMLElement, label: string) {
    return Array.from(page.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!;
  }

  it('shows the product and its stock', async () => {
    const page = (await render('100001')).nativeElement as HTMLElement;

    expect(service.get).toHaveBeenCalledWith(100001);
    expect(page.querySelector('h1')?.textContent).toBe('Primo Star');
    expect(page.querySelector('.subtitle')?.textContent).toBe('Product number 100001');
    expect(page.querySelector('.reading')?.textContent).toContain('6 in stock');
    expect(page.querySelector('.reading .status')?.textContent?.trim()).toBe('Low');
    expect(page.querySelector('.reading .scale')?.getAttribute('style')).toContain('--stock: 6');
  });

  it('adds the typed quantity to stock', async () => {
    const fixture = await render('100001');
    const page = fixture.nativeElement as HTMLElement;

    const quantity = page.querySelector<HTMLInputElement>('input[aria-label="Quantity"]')!;
    quantity.value = '3';
    quantity.dispatchEvent(new Event('input'));
    page.querySelector<HTMLButtonElement>('button[aria-label="Add to stock"]')!.click();
    await fixture.whenStable();

    expect(service.addToStock).toHaveBeenCalledWith(100001, 3);
    expect(page.querySelector('.reading')?.textContent).toContain('9 in stock');
    expect(page.querySelector('.message')?.textContent).toBe('Added 3 to stock');
  });

  it('shows the price with two decimals, and saves it as a number', async () => {
    const fixture = await render('100001');
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector<HTMLInputElement>('input[formcontrolname="price"]')?.value).toBe('2.450,00');

    button(page, 'Save changes').click();
    await fixture.whenStable();

    expect(service.update).toHaveBeenCalledWith(100001, {
      name: 'Primo Star',
      description: 'Upright microscope',
      price: 2450,
      stock: 6,
      categoryId: 1,
    });
  });

  async function typeInto(fixture: Awaited<ReturnType<typeof render>>, control: string, value: string) {
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(`[formcontrolname="${control}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    return input;
  }

  it('masks the price while typing, as 0.000,00', async () => {
    const fixture = await render('100001');

    expect((await typeInto(fixture, 'price', '2')).value).toBe('0,02');
    expect((await typeInto(fixture, 'price', '245000')).value).toBe('2.450,00');
    expect((await typeInto(fixture, 'price', '2.450,0')).value).toBe('245,00');
  });

  it('shows Unsaved changes after a change, and asks before leaving', async () => {
    const askToLeave = vi.spyOn(TestBed.inject(Confirmation), 'askToLeave').mockResolvedValue(false);
    const fixture = await render('100001');
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector('.unsaved')).toBeNull();
    expect(fixture.componentInstance.canLeave()).toBe(true);

    await typeInto(fixture, 'name', 'Primo Star HD');

    expect(page.querySelector('.unsaved')?.textContent).toBe('Unsaved changes');
    expect(await fixture.componentInstance.canLeave()).toBe(false);
    expect(askToLeave).toHaveBeenCalled();
  });

  it('hides Unsaved changes again when a change is undone, and then leaves without asking', async () => {
    const askToLeave = vi.spyOn(TestBed.inject(Confirmation), 'askToLeave');
    const fixture = await render('100001');
    const page = fixture.nativeElement as HTMLElement;

    await typeInto(fixture, 'name', 'Primo Star HD');
    expect((await typeInto(fixture, 'price', '2.450,001')).value).toBe('24.500,01');
    expect(page.querySelector('.unsaved')).not.toBeNull();

    await typeInto(fixture, 'name', 'Primo Star');
    expect(page.querySelector('.unsaved')).not.toBeNull();

    expect((await typeInto(fixture, 'price', '24.500,0')).value).toBe('2.450,00');

    expect(page.querySelector('.unsaved')).toBeNull();
    expect(fixture.componentInstance.canLeave()).toBe(true);
    expect(askToLeave).not.toHaveBeenCalled();
  });

  it('makes the browser ask before closing the tab with unsaved changes', async () => {
    const fixture = await render('100001');
    const closeTab = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(closeTab()).toBe(false);
    await typeInto(fixture, 'name', 'Primo Star HD');
    expect(closeTab()).toBe(true);
  });

  it('does not delete when the user cancels the dialog', async () => {
    const ask = vi.spyOn(TestBed.inject(Confirmation), 'askToDelete').mockResolvedValue(false);
    const fixture = await render('100001');

    await deleteFromMenu(fixture);

    expect(ask).toHaveBeenCalledWith('"Primo Star"');
    expect(service.delete).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('.menu')).toBeNull();
  });

  it('deletes and goes back to the list when the user confirms in the dialog', async () => {
    vi.spyOn(TestBed.inject(Confirmation), 'askToDelete').mockResolvedValue(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = await render('100001');

    await deleteFromMenu(fixture);

    expect(service.delete).toHaveBeenCalledWith(100001);
    expect(navigate).toHaveBeenCalledWith(['/products']);
  });

  it('shows an empty form with a starting stock for a new product', async () => {
    const page = (await render()).nativeElement as HTMLElement;

    expect(service.get).not.toHaveBeenCalled();
    expect(page.querySelector('h1')?.textContent).toBe('New product');
    expect(page.querySelector('input[formcontrolname="stock"]')).not.toBeNull();
    expect(page.querySelector('button[aria-haspopup]')).toBeNull();
  });

  it('has a Cancel button that goes back to the list without saving', async () => {
    const page = (await render('100001')).nativeElement as HTMLElement;

    const cancel = Array.from(page.querySelectorAll('a')).find((a) => a.textContent?.trim() === 'Cancel');

    expect(cancel?.getAttribute('href')).toBe('/products');
  });

  it('shows the API message with Try again when the product cannot be loaded, and Try again loads it', async () => {
    service.get.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404, error: { detail: 'Product 100001 was not found.' } })));
    const fixture = await render('100001');
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector('.error')?.textContent).toContain('Product 100001 was not found.');
    expect(page.querySelector('h1')).toBeNull();

    button(page, 'Try again').click();
    await fixture.whenStable();

    expect(page.querySelector('.error')).toBeNull();
    expect(page.querySelector('h1')?.textContent).toBe('Primo Star');
  });
});

describe('maskPrice', () => {
  it('reads the digits as cents and shows them as 0.000,00', () => {
    expect(maskPrice('')).toBe('');
    expect(maskPrice('7')).toBe('0,07');
    expect(maskPrice('1234567')).toBe('12.345,67');
    expect(maskPrice('12a3')).toBe('1,23');
    expect(maskPrice('0,005')).toBe('0,05');
  });
});
