import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProductList, productsCsv } from './product-list';
import { Product, ProductService } from './product.service';

const products: Product[] = [
  {
    id: 100001,
    name: 'Primo Star',
    description: 'Upright microscope',
    price: 2450,
    stock: 6,
    categoryId: 1,
    categoryName: 'Microscopes',
    createdAt: '2024-06-01T08:00:00Z',
    updatedAt: '2024-06-01T08:00:00Z',
  },
  {
    id: 100007,
    name: 'LED illuminator',
    description: null,
    price: 210,
    stock: 0,
    categoryId: 3,
    categoryName: 'Accessories',
    createdAt: '2024-06-01T08:00:00Z',
    updatedAt: '2024-06-01T08:00:00Z',
  },
];

describe('ProductList', () => {
  const service = {
    getAll: vi.fn(() => of(products)),
    search: vi.fn(() => of([products[0]])),
    getByStockLevel: vi.fn(() => of([products[1]])),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ProductList],
      providers: [provideRouter([]), { provide: ProductService, useValue: service }],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(ProductList);
    await fixture.whenStable();
    return fixture;
  }

  /** Types into the box with this visible label, then waits out the 300 ms pause before the search runs. */
  async function type(fixture: Awaited<ReturnType<typeof render>>, label: string, value: string) {
    const labels = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('label'));
    const input = labels.find((l) => l.querySelector('span')?.textContent === label)!.querySelector('input')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 350));
    await fixture.whenStable();
  }

  function names(fixture: Awaited<ReturnType<typeof render>>) {
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    return Array.from(rows).map((row) => row.querySelector('a')?.textContent);
  }

  it('lists each product by name, with a link to its screen and its stock', async () => {
    const fixture = await render();
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');

    expect(names(fixture)).toEqual(['LED illuminator', 'Primo Star']);
    expect(rows[0].textContent).toContain('Out of stock');
    expect(rows[1].querySelector('a')?.getAttribute('href')).toBe('/products/100001');
    expect(rows[1].textContent).toContain('6');
  });

  it('searches by name while typing, without a button', async () => {
    const fixture = await render();

    await type(fixture, 'Name', 'primo');

    expect(service.search).toHaveBeenCalledWith('primo');
    expect(names(fixture)).toEqual(['Primo Star']);
  });

  it('uses the stock range endpoint, open-ended up to the API maximum, and filters it by name', async () => {
    const fixture = await render();

    await type(fixture, 'Min stock', '0');
    await type(fixture, 'Name', 'led');

    expect(service.getByStockLevel).toHaveBeenLastCalledWith(0, 1000000);
    expect(service.search).not.toHaveBeenCalled();
    expect(names(fixture)).toEqual(['LED illuminator']);
  });

  it('shows 10 products a page, with arrows and the range below the table', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      ...products[0],
      id: 200001 + i,
      name: `Product ${String(i + 1).padStart(2, '0')}`,
    }));
    service.getAll.mockReturnValueOnce(of(many));
    const fixture = await render();
    const page = fixture.nativeElement as HTMLElement;
    const pill = () => page.querySelector('.pill')!.textContent!.trim();

    expect(names(fixture).length).toBe(10);
    expect(pill()).toBe('1–10 of 12 products');

    page.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!.click();
    await fixture.whenStable();

    expect(names(fixture)).toEqual(['Product 11', 'Product 12']);
    expect(pill()).toBe('11–12 of 12 products');
  });

  it('changes the page size from the menu behind the range', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...products[0], id: 200001 + i, name: `Product ${i}` }));
    service.getAll.mockReturnValueOnce(of(many));
    const fixture = await render();
    const page = fixture.nativeElement as HTMLElement;

    page.querySelector<HTMLButtonElement>('.pill')!.click();
    await fixture.whenStable();
    expect(page.querySelector('.menu')?.textContent).toContain('Products per page');

    Array.from(page.querySelectorAll<HTMLButtonElement>('.menu button')).find((b) => b.textContent?.trim() === '5')!.click();
    await fixture.whenStable();

    expect(names(fixture).length).toBe(5);
    expect(page.querySelector('.pill')!.textContent!.trim()).toBe('1–5 of 12 products');
    expect(page.querySelector('.menu')).toBeNull();
  });

  it('sorts by a column heading, and reverses on a second click', async () => {
    const fixture = await render();
    const page = fixture.nativeElement as HTMLElement;
    const heading = (label: string) =>
      Array.from(page.querySelectorAll('th')).find((th) => th.textContent?.trim() === label)!;

    expect(heading('Name').getAttribute('aria-sort')).toBe('ascending');

    heading('Price').querySelector('button')!.click();
    await fixture.whenStable();
    expect(names(fixture)).toEqual(['LED illuminator', 'Primo Star']);
    expect(heading('Price').getAttribute('aria-sort')).toBe('ascending');
    expect(heading('Name').getAttribute('aria-sort')).toBe('none');

    heading('Price').querySelector('button')!.click();
    await fixture.whenStable();
    expect(names(fixture)).toEqual(['Primo Star', 'LED illuminator']);
    expect(heading('Price').getAttribute('aria-sort')).toBe('descending');
  });

  it('exports the products as a CSV file named products.csv', async () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:products');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const page = (await render()).nativeElement as HTMLElement;

    Array.from(page.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Export')!.click();

    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe('products.csv');
    const text = await createObjectURL.mock.calls[0][0].text();
    expect(text).toContain('Product number,Name,Category,Price (EUR),Stock');
    expect(text).toContain('100001,Primo Star,Microscopes,2450.00,6');
  });
});

describe('ProductList rows', () => {
  const service = { getAll: vi.fn(() => of(products)), delete: vi.fn(() => of(undefined)) };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ProductList],
      providers: [provideRouter([]), { provide: ProductService, useValue: service }],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(ProductList);
    await fixture.whenStable();
    return fixture;
  }

  it('opens the product when a row is clicked anywhere but its checkbox', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = await render();
    const row = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')[1];

    row.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    expect(navigate).not.toHaveBeenCalled();

    (row.querySelector('td.wide') as HTMLElement).click();
    expect(navigate).toHaveBeenCalledWith(['/products', 100001]);
  });

  it('exports only the ticked rows when any are ticked', async () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:products');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const fixture = await render();
    const page = fixture.nativeElement as HTMLElement;

    page.querySelectorAll('tbody tr')[1].querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    await fixture.whenStable();
    Array.from(page.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Export')!.click();

    const lines = (await createObjectURL.mock.calls[0][0].text()).trim().split('\n');
    expect(lines.length).toBe(2);
    expect(lines[1]).toBe('100001,Primo Star,Microscopes,2450.00,6');
  });
});

describe('ProductList selection bar', () => {
  const service = { getAll: vi.fn(() => of(products)), delete: vi.fn(() => of(undefined)) };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ProductList],
      providers: [provideRouter([]), { provide: ProductService, useValue: service }],
    }).compileComponents();
  });

  async function renderWithBothTicked() {
    const fixture = TestBed.createComponent(ProductList);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    page.querySelectorAll<HTMLInputElement>('tbody input[type=checkbox]').forEach((box) => box.click());
    await fixture.whenStable();
    return { fixture, page, bar: () => page.querySelector('.selection-bar') };
  }

  it('appears with the count only while rows are ticked, and the close button clears it', async () => {
    const { fixture, page, bar } = await renderWithBothTicked();

    expect(bar()?.textContent).toContain('2 selected');

    page.querySelector<HTMLButtonElement>('button[aria-label="Clear selection"]')!.click();
    await fixture.whenStable();

    expect(bar()).toBeNull();
    expect(page.querySelectorAll('tbody input[type=checkbox]:checked').length).toBe(0);
  });

  it('deletes every ticked product after a confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { fixture, bar } = await renderWithBothTicked();

    bar()!.querySelector<HTMLButtonElement>('button.danger')!.click();
    await fixture.whenStable();

    expect(confirm).toHaveBeenCalledWith('Delete 2 products?');
    expect(service.delete).toHaveBeenCalledWith(100007);
    expect(service.delete).toHaveBeenCalledWith(100001);
    expect(bar()).toBeNull();
  });

  it('deletes nothing when the user cancels', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { bar } = await renderWithBothTicked();

    bar()!.querySelector<HTMLButtonElement>('button.danger')!.click();

    expect(service.delete).not.toHaveBeenCalled();
  });
});

describe('productsCsv', () => {
  it('quotes values that contain commas or quotes', () => {
    const csv = productsCsv([{ ...products[0], name: 'Lens, "large"' }]);

    expect(csv.split('\n')[1]).toBe('100001,"Lens, ""large""",Microscopes,2450.00,6');
  });
});
