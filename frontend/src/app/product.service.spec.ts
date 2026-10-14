import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Confirmation, ProductInput, ProductService, errorMessage, isUnreachable, stockStatus } from './product.service';

describe('ProductService', () => {
  let service: ProductService;
  let http: HttpTestingController;

  const input: ProductInput = {
    name: 'Lens cloth',
    description: null,
    price: 12.5,
    stock: 20,
    categoryId: 3,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ProductService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists products', () => {
    service.getAll().subscribe();
    expect(http.expectOne('/api/products').request.method).toBe('GET');
  });

  it('gets one product', () => {
    service.get(100001).subscribe();
    expect(http.expectOne('/api/products/100001').request.method).toBe('GET');
  });

  it('creates a product', () => {
    service.create(input).subscribe();
    const request = http.expectOne('/api/products');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
  });

  it('updates a product', () => {
    service.update(100001, input).subscribe();
    const request = http.expectOne('/api/products/100001');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(input);
  });

  it('deletes a product', () => {
    service.delete(100001).subscribe();
    expect(http.expectOne('/api/products/100001').request.method).toBe('DELETE');
  });

  it('decrements stock', () => {
    service.decrementStock(100001, 3).subscribe();
    const request = http.expectOne('/api/products/100001/decrement-stock/3');
    expect(request.request.method).toBe('POST');
  });

  it('adds to stock', () => {
    service.addToStock(100001, 3).subscribe();
    const request = http.expectOne('/api/products/100001/add-to-stock/3');
    expect(request.request.method).toBe('POST');
  });

  it('searches by name', () => {
    service.search('stemi').subscribe();
    const request = http.expectOne((r) => r.url === '/api/products/search');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('name')).toBe('stemi');
  });

  it('queries a stock range', () => {
    service.getByStockLevel(0, 5).subscribe();
    const request = http.expectOne((r) => r.url === '/api/products/stock-level');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('min')).toBe('0');
    expect(request.request.params.get('max')).toBe('5');
  });

  it('lists categories', () => {
    service.getCategories().subscribe();
    expect(http.expectOne('/api/categories').request.method).toBe('GET');
  });
});

describe('errorMessage', () => {
  it('uses the field errors of a 400', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { errors: { name: ['Name is required.'], price: ['Price has to be greater than zero.'] } },
    });
    expect(errorMessage(error)).toBe('Name is required. Price has to be greater than zero.');
  });

  it('uses the detail of other errors', () => {
    const error = new HttpErrorResponse({ status: 409, error: { detail: 'Not enough stock.' } });
    expect(errorMessage(error)).toBe('Not enough stock.');
  });

  it('says so when the API cannot be reached', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 0 }))).toBe('The API is not reachable');
    expect(errorMessage(new HttpErrorResponse({ status: 502 }))).toBe('The API is not reachable');
  });
});

describe('isUnreachable', () => {
  it('is true when no answer came back, and false when the API answered with a problem', () => {
    expect(isUnreachable(new HttpErrorResponse({ status: 0 }))).toBe(true);
    expect(isUnreachable(new HttpErrorResponse({ status: 502 }))).toBe(true);
    expect(isUnreachable(new HttpErrorResponse({ status: 409, error: { detail: 'Not enough stock.' } }))).toBe(false);
    expect(isUnreachable(new HttpErrorResponse({ status: 503, error: { detail: 'Product ids ran out.' } }))).toBe(false);
  });
});

describe('stockStatus', () => {
  it('names the stock badge for a count', () => {
    expect(stockStatus(0)).toBe('Out of Stock');
    expect(stockStatus(1)).toBe('Critical');
    expect(stockStatus(3)).toBe('Critical');
    expect(stockStatus(4)).toBe('Low');
    expect(stockStatus(9)).toBe('Low');
    expect(stockStatus(10)).toBe('In Stock');
  });
});

describe('Confirmation', () => {
  it('holds the question until the user answers, then resolves with the answer and closes', async () => {
    const confirmation = new Confirmation();

    const answer = confirmation.askToDelete('"Primo Star"');
    expect(confirmation.question()).toEqual({ title: 'Delete "Primo Star"?', text: 'This cannot be undone', action: 'Delete' });

    confirmation.answer(true);

    expect(await answer).toBe(true);
    expect(confirmation.question()).toBeNull();
  });

  it('asks before leaving unsaved changes', () => {
    const confirmation = new Confirmation();

    confirmation.askToLeave();

    expect(confirmation.question()?.title).toBe('Leave without saving?');
    expect(confirmation.question()?.action).toBe('Leave');
  });
});
