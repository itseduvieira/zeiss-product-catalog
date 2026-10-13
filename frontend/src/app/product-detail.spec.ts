import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProductDetail } from './product-detail';
import { Product, ProductService } from './product.service';

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

  function button(page: HTMLElement, label: string) {
    return Array.from(page.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!;
  }

  it('shows the product and its stock', async () => {
    const page = (await render('100001')).nativeElement as HTMLElement;

    expect(service.get).toHaveBeenCalledWith(100001);
    expect(page.querySelector('h1')?.textContent).toBe('Primo Star');
    expect(page.querySelector('.reading')?.textContent?.trim()).toBe('6 in stock');
  });

  it('adds the typed quantity to stock', async () => {
    const fixture = await render('100001');
    const page = fixture.nativeElement as HTMLElement;

    const quantity = page.querySelector<HTMLInputElement>('input[aria-label="Quantity"]')!;
    quantity.value = '3';
    quantity.dispatchEvent(new Event('input'));
    button(page, 'Add').click();
    await fixture.whenStable();

    expect(service.addToStock).toHaveBeenCalledWith(100001, 3);
    expect(page.querySelector('.reading')?.textContent?.trim()).toBe('9 in stock');
  });

  it('does not delete when the user cancels', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const page = (await render('100001')).nativeElement as HTMLElement;

    button(page, 'Delete product').click();

    expect(service.delete).not.toHaveBeenCalled();
  });

  it('deletes and goes back to the list when the user confirms', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const page = (await render('100001')).nativeElement as HTMLElement;

    button(page, 'Delete product').click();

    expect(service.delete).toHaveBeenCalledWith(100001);
    expect(navigate).toHaveBeenCalledWith(['/products']);
  });

  it('shows an empty form with a starting stock for a new product', async () => {
    const page = (await render()).nativeElement as HTMLElement;

    expect(service.get).not.toHaveBeenCalled();
    expect(page.querySelector('h1')?.textContent).toBe('New product');
    expect(page.querySelector('input[formcontrolname="stock"]')).not.toBeNull();
  });
});
