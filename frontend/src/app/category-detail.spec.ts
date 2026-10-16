import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CategoryDetail } from './category-detail';
import { Category, Confirmation, Notice, ProductService } from './product.service';

const optics: Category = { id: 2, name: 'Optics', description: 'Objectives, eyepieces and cameras', productCount: 3, isUncategorized: false };
const lenses: Category = { id: 4, name: 'Lenses', description: 'Spectacle lenses', productCount: 0, isUncategorized: false };

describe('CategoryDetail', () => {
  const service = {
    getCategory: vi.fn((id: number) => of(id === 4 ? lenses : optics)),
    createCategory: vi.fn(() => of(lenses)),
    updateCategory: vi.fn(() => of({ ...optics, name: 'Objectives' })),
    deleteCategory: vi.fn(() => of(undefined)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [CategoryDetail],
      providers: [provideRouter([]), { provide: ProductService, useValue: service }],
    }).compileComponents();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  async function render(id?: string) {
    const fixture = TestBed.createComponent(CategoryDetail);
    if (id) {
      fixture.componentRef.setInput('id', id);
    }
    await fixture.whenStable();
    return fixture;
  }

  async function type(fixture: Awaited<ReturnType<typeof render>>, control: string, value: string) {
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(`[formcontrolname="${control}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
  }

  function button(page: HTMLElement, text: string) {
    return Array.from(page.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;
  }

  async function deleteFromMenu(fixture: Awaited<ReturnType<typeof render>>, name: string) {
    const page = fixture.nativeElement as HTMLElement;
    page.querySelector<HTMLButtonElement>(`button[aria-label="Actions for ${name}"]`)!.click();
    await fixture.whenStable();
    page.querySelector<HTMLButtonElement>('.menu button.danger')!.click();
    await fixture.whenStable();
  }

  it('shows the category, its number of products, and its details', async () => {
    const page = (await render('2')).nativeElement as HTMLElement;

    expect(service.getCategory).toHaveBeenCalledWith(2);
    expect(page.querySelector('h1')?.textContent).toBe('Optics');
    expect(page.querySelector('.subtitle')?.textContent).toBe('3 products');
    expect(page.querySelector<HTMLInputElement>('[formcontrolname="name"]')?.value).toBe('Optics');
  });

  it('saves changes, goes back to the list, and says so, with Unsaved changes shown only before', async () => {
    const fixture = await render('2');
    const page = fixture.nativeElement as HTMLElement;

    await type(fixture, 'name', ' Objectives ');
    expect(page.querySelector('.unsaved')).not.toBeNull();

    button(page, 'Save changes').click();
    await fixture.whenStable();

    expect(service.updateCategory).toHaveBeenCalledWith(2, { name: 'Objectives', description: 'Objectives, eyepieces and cameras' });
    expect(page.querySelector('.unsaved')).toBeNull();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/categories']);
    expect(TestBed.inject(Notice).text()).toBe('Objectives saved');
  });

  it('creates a category, goes back to the list, and says so', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = await render();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector('h1')?.textContent).toBe('New category');
    await type(fixture, 'name', 'Lenses');
    await type(fixture, 'description', 'Spectacle lenses');
    button(page, 'Create category').click();
    await fixture.whenStable();

    expect(service.createCategory).toHaveBeenCalledWith({ name: 'Lenses', description: 'Spectacle lenses' });
    expect(navigate).toHaveBeenCalledWith(['/categories']);
    expect(TestBed.inject(Notice).text()).toBe('Lenses created');
  });

  it('shows the API message when the name is taken', async () => {
    service.updateCategory.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'A category named Microscopes already exists.' } })),
    );
    const fixture = await render('2');
    const page = fixture.nativeElement as HTMLElement;

    await type(fixture, 'name', 'Microscopes');
    button(page, 'Save changes').click();
    await fixture.whenStable();

    expect(TestBed.inject(Notice).message()).toEqual({ text: 'A category named Microscopes already exists.', error: true });
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('deletes an empty category after the dialog, and goes back to the list', async () => {
    vi.spyOn(TestBed.inject(Confirmation), 'askToDelete').mockResolvedValue(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = await render('4');

    await deleteFromMenu(fixture, 'Lenses');

    expect(service.deleteCategory).toHaveBeenCalledWith(4, false);
    expect(navigate).toHaveBeenCalledWith(['/categories']);
    expect(TestBed.inject(Notice).text()).toBe('Lenses deleted');
  });

  it('deletes a category that products use by moving its products to Uncategorized', async () => {
    const askToDelete = vi.spyOn(TestBed.inject(Confirmation), 'askToDelete').mockResolvedValue(true);
    const fixture = await render('2');

    await deleteFromMenu(fixture, 'Optics');

    expect(askToDelete).toHaveBeenCalledWith('"Optics"', 3);
    expect(service.deleteCategory).toHaveBeenCalledWith(2, true);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/categories']);
    expect(TestBed.inject(Notice).text()).toBe('Optics deleted, 3 products moved to Uncategorized');
  });

  it('offers no Delete for Uncategorized, and keeps its name', async () => {
    service.getCategory.mockReturnValueOnce(
      of({ id: 6, name: 'Uncategorized', description: 'Products without a category', productCount: 1, isUncategorized: true }),
    );
    const page = (await render('6')).nativeElement as HTMLElement;

    expect(page.querySelector('button[aria-label="Actions for Uncategorized"]')).toBeNull();
    expect(page.querySelector<HTMLInputElement>('[formcontrolname="name"]')?.readOnly).toBe(true);
  });

  it('shows Category not found for an unknown or invalid id', async () => {
    service.getCategory.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404 })));
    const unknown = (await render('999')).nativeElement as HTMLElement;
    expect(unknown.querySelector('.empty-state h1')?.textContent).toBe('Category not found');

    const invalid = (await render('abc')).nativeElement as HTMLElement;
    expect(invalid.querySelector('.empty-state p')?.textContent).toBe('There is no category abc in the catalog');
  });
});
