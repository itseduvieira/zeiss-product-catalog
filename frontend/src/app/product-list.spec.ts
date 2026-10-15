import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ProductList, productsCsv } from './product-list';
import { ApiStatus, Confirmation, Product, ProductService } from './product.service';

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

const twelveProducts = Array.from({ length: 12 }, (_, i) => ({
  ...products[0],
  id: 200001 + i,
  name: `Product ${String(i + 1).padStart(2, '0')}`,
}));

describe('ProductList', () => {
  const service = {
    getAll: vi.fn(() => of(products)),
    search: vi.fn(() => of([products[0]])),
    getByStockLevel: vi.fn(() => of([products[1]])),
    delete: vi.fn(() => of(undefined)),
  };

  let fixture: ComponentFixture<ProductList>;
  let page: HTMLElement;

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ProductList],
      providers: [provideRouter([]), { provide: ProductService, useValue: service }],
    }).compileComponents();
  });

  async function render() {
    fixture = TestBed.createComponent(ProductList);
    page = fixture.nativeElement;
    await fixture.whenStable();
  }

  async function type(label: string, value: string) {
    const input = page.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function click(element: HTMLElement) {
    element.click();
    await fixture.whenStable();
  }

  function button(text: string) {
    return Array.from(page.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
  }

  function names() {
    return Array.from(page.querySelectorAll('tbody tr')).map((row) => row.querySelector('a')?.textContent);
  }

  async function openFilters() {
    await click(Array.from(page.querySelectorAll('button')).find((b) => b.textContent?.includes('Filters'))!);
  }

  async function tickAllRows() {
    page.querySelectorAll<HTMLInputElement>('tbody input[type=checkbox]').forEach((box) => box.click());
    await fixture.whenStable();
  }

  function exportCsv() {
    const linkClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    page.querySelector<HTMLButtonElement>('button[aria-label="Export as CSV"]')!.click();
    const link = linkClick.mock.contexts[0] as HTMLAnchorElement;
    const href = link.getAttribute('href')!;
    return { fileName: link.download, text: decodeURIComponent(href.slice(href.indexOf(',') + 1)) };
  }

  it('lists each product in the order the API sends, with a link to its screen and its stock', async () => {
    await render();
    const rows = page.querySelectorAll('tbody tr');

    expect(names()).toEqual(['Primo Star', 'LED illuminator']);
    expect(rows[0].querySelector('.scale')?.getAttribute('style')).toContain('--stock: 6');
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/products/100001');
    expect(rows[1].querySelector('.status')?.textContent?.trim()).toBe('Out of Stock');
    expect(rows[0].querySelector('td.number')?.textContent?.trim()).toBe('2.450,00');
  });

  it('searches while typing, without a button', async () => {
    await render();

    await type('Search by name, ID or category', 'primo');

    expect(service.search).toHaveBeenCalledWith('primo');
    expect(names()).toEqual(['Primo Star']);
  });

  it('keeps the stock and price filters hidden until Filters is pressed', async () => {
    await render();

    expect(page.querySelector('input[aria-label="Min stock"]')).toBeNull();
    await openFilters();
    expect(page.querySelector('input[aria-label="Min stock"]')).not.toBeNull();
    expect(page.querySelector('input[aria-label="Max price (€)"]')).not.toBeNull();
  });

  it('uses the stock range endpoint for a range alone, open-ended up to the API maximum', async () => {
    await render();

    await openFilters();
    await type('Min stock', '0');

    expect(service.getByStockLevel).toHaveBeenLastCalledWith(0, 1000000);
    expect(names()).toEqual(['LED illuminator']);
  });

  it('uses the search endpoint for search text with a stock range, and keeps the products in the range', async () => {
    await render();
    service.search.mockReturnValueOnce(of(products));

    await openFilters();
    await type('Min stock', '1');
    await type('Search by name, ID or category', 'r');

    expect(service.search).toHaveBeenLastCalledWith('r');
    expect(names()).toEqual(['Primo Star']);
  });

  it('shows 10 products a page, with arrows and the range below the table', async () => {
    service.getAll.mockReturnValueOnce(of(twelveProducts));
    await render();
    const pill = () => page.querySelector('.pill')!.textContent!.trim();

    expect(names().length).toBe(10);
    expect(pill()).toBe('1–10 of 12 products');

    await click(page.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!);

    expect(names()).toEqual(['Product 11', 'Product 12']);
    expect(pill()).toBe('11–12 of 12 products');
  });

  it('changes the page size from the menu behind the range', async () => {
    service.getAll.mockReturnValueOnce(of(twelveProducts));
    await render();

    await click(page.querySelector<HTMLButtonElement>('.pill')!);
    expect(page.querySelector('.menu')?.textContent).toContain('Products per page');

    await click(Array.from(page.querySelectorAll<HTMLButtonElement>('.menu button')).find((b) => b.textContent?.trim() === '5')!);

    expect(names().length).toBe(5);
    expect(page.querySelector('.pill')!.textContent!.trim()).toBe('1–5 of 12 products');
    expect(page.querySelector('.menu')).toBeNull();
  });

  it('filters by a price range in the app, and counts the active filters on the Filters button', async () => {
    await render();

    await openFilters();
    await type('Min price (€)', '1000');

    expect(names()).toEqual(['Primo Star']);
    expect(page.querySelector('.badge')?.textContent?.trim()).toBe('1');
  });

  it('filters by the statuses ticked in the Status dropdown', async () => {
    await render();

    await openFilters();
    const dropdown = page.querySelector<HTMLButtonElement>('.filter-bar .select')!;
    expect(dropdown.textContent?.trim()).toBe('All');

    await click(dropdown);
    const option = (label: string) =>
      Array.from(page.querySelectorAll('.menu .option')).find((o) => o.textContent?.trim() === label)!.querySelector('input')!;
    await click(option('Out of Stock'));

    expect(names()).toEqual(['LED illuminator']);
    expect(dropdown.textContent?.trim()).toBe('Out of Stock');

    await click(option('Low'));

    expect(names()).toEqual(['Primo Star', 'LED illuminator']);
    expect(dropdown.textContent?.trim()).toBe('2 selected');
    expect(page.querySelector('.badge')?.textContent?.trim()).toBe('1');
  });

  it('shows Clear filters only while a filter is set, and it clears them all', async () => {
    await render();

    await openFilters();
    expect(button('Clear filters')).toBeUndefined();

    await type('Min price (€)', '1000');
    expect(names()).toEqual(['Primo Star']);

    await click(button('Clear filters')!);

    expect(names()).toEqual(['Primo Star', 'LED illuminator']);
    expect(button('Clear filters')).toBeUndefined();
    expect(page.querySelector('.badge')).toBeNull();
  });

  it('sorts by a column heading, and reverses on a second click', async () => {
    await render();
    const heading = (label: string) => Array.from(page.querySelectorAll('th')).find((th) => th.textContent?.trim() === label)!;

    expect(heading('Name').getAttribute('aria-sort')).toBe('none');

    await click(heading('Price (€)').querySelector('button')!);
    expect(names()).toEqual(['LED illuminator', 'Primo Star']);
    expect(heading('Price (€)').getAttribute('aria-sort')).toBe('ascending');
    expect(heading('Name').getAttribute('aria-sort')).toBe('none');

    await click(heading('Price (€)').querySelector('button')!);
    expect(names()).toEqual(['Primo Star', 'LED illuminator']);
    expect(heading('Price (€)').getAttribute('aria-sort')).toBe('descending');
  });

  it('exports the products as a CSV file named products.csv', async () => {
    await render();

    const { fileName, text } = exportCsv();

    expect(fileName).toBe('products.csv');
    expect(text).toContain('"Product number","Name","Category","Price (€)","Stock"');
    expect(text).toContain('"100001","Primo Star","Microscopes","2.450,00","6"');
  });

  it('exports every product, even when some rows are ticked', async () => {
    await render();

    await click(page.querySelectorAll('tbody tr')[1].querySelector<HTMLInputElement>('input[type=checkbox]')!);
    const { text } = exportCsv();

    expect(text.trim().split('\n').length).toBe(3);
  });

  it('opens the product when a row is clicked anywhere but its checkbox', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await render();
    const row = page.querySelectorAll('tbody tr')[0];

    row.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    expect(navigate).not.toHaveBeenCalled();

    row.querySelector<HTMLElement>('td.wide')!.click();
    expect(navigate).toHaveBeenCalledWith(['/products', 100001]);
  });

  it('deletes one product from the ⋯ menu on its row, after a confirmation, without opening it', async () => {
    const ask = vi.spyOn(TestBed.inject(Confirmation), 'askToDelete').mockResolvedValue(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await render();

    await click(page.querySelector<HTMLButtonElement>('button[aria-label="Actions for Primo Star"]')!);
    await click(page.querySelector<HTMLButtonElement>('.menu button.danger')!);

    expect(ask).toHaveBeenCalledWith('"Primo Star"');
    expect(service.delete).toHaveBeenCalledTimes(1);
    expect(service.delete).toHaveBeenCalledWith(100001);
    expect(navigate).not.toHaveBeenCalled();
    expect(page.querySelector('.menu')).toBeNull();
  });

  it('opens the row menu below a row, and above the last row', async () => {
    await render();

    await click(page.querySelector<HTMLButtonElement>('button[aria-label="Actions for Primo Star"]')!);
    expect(page.querySelector('.menu')?.classList).toContain('below');

    await click(page.querySelector<HTMLButtonElement>('button[aria-label="Actions for LED illuminator"]')!);
    expect(page.querySelectorAll('.menu').length).toBe(1);
    expect(page.querySelector('.menu')?.classList).not.toContain('below');
  });

  it('shows the selection bar with the count only while rows are ticked, and its close button clears the ticks', async () => {
    await render();
    await tickAllRows();

    expect(page.querySelector('.selection-bar')?.textContent).toContain('2 selected');

    await click(page.querySelector<HTMLButtonElement>('button[aria-label="Clear selection"]')!);

    expect(page.querySelector('.selection-bar')).toBeNull();
    expect(page.querySelectorAll('tbody input[type=checkbox]:checked').length).toBe(0);
  });

  it('deletes every ticked product after a confirmation', async () => {
    const ask = vi.spyOn(TestBed.inject(Confirmation), 'askToDelete').mockResolvedValue(true);
    await render();
    await tickAllRows();

    await click(page.querySelector<HTMLButtonElement>('.selection-bar button.danger')!);

    expect(ask).toHaveBeenCalledWith('2 products');
    expect(service.delete).toHaveBeenCalledWith(100001);
    expect(service.delete).toHaveBeenCalledWith(100007);
    expect(page.querySelector('.selection-bar')).toBeNull();
  });

  it('deletes nothing when the user cancels', async () => {
    vi.spyOn(TestBed.inject(Confirmation), 'askToDelete').mockResolvedValue(false);
    await render();
    await tickAllRows();

    await click(page.querySelector<HTMLButtonElement>('.selection-bar button.danger')!);

    expect(service.delete).not.toHaveBeenCalled();
  });

  it('turns on the ribbon instead of an inline message when the API cannot be reached, until a load succeeds', async () => {
    service.getAll.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    await render();
    const api = TestBed.inject(ApiStatus);

    expect(api.unreachable()).toBe(true);
    expect(page.querySelector('.error')).toBeNull();
    expect(page.textContent).not.toContain('There are no products yet');

    await type('Search by name, ID or category', 'primo');

    expect(api.unreachable()).toBe(false);
    expect(names()).toEqual(['Primo Star']);
  });
});

describe('productsCsv', () => {
  it('quotes every value, and doubles the quotes inside one', () => {
    const csv = productsCsv([{ ...products[0], name: 'Lens, "large"' }]);

    expect(csv.split('\n')[1]).toBe('"100001","Lens, ""large""","Microscopes","2.450,00","6"');
  });
});
