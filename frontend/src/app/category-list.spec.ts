import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CategoryList } from './category-list';
import { Category, Confirmation, Notice, ProductService } from './product.service';

const categories: Category[] = [
  { id: 1, name: 'Microscopes', description: 'Upright and stereo microscopes', productCount: 2, isUncategorized: false },
  { id: 2, name: 'Optics', description: 'Objectives, eyepieces and cameras', productCount: 3, isUncategorized: false },
  { id: 4, name: 'Lenses', description: 'Spectacle lenses', productCount: 0, isUncategorized: false },
  { id: 5, name: 'Filters', description: 'Filter sets', productCount: 0, isUncategorized: false },
];

describe('CategoryList', () => {
  const service = {
    getCategories: vi.fn(() => of(categories)),
    deleteCategory: vi.fn(() => of(undefined)),
  };

  let fixture: ComponentFixture<CategoryList>;
  let page: HTMLElement;

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [CategoryList],
      providers: [provideRouter([]), { provide: ProductService, useValue: service }],
    }).compileComponents();
    fixture = TestBed.createComponent(CategoryList);
    page = fixture.nativeElement;
    await fixture.whenStable();
  });

  function rows() {
    return Array.from(page.querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('td'))
        .slice(1, 5)
        .map((cell) => cell.textContent?.trim()),
    );
  }

  function names() {
    return rows().map((row) => row[1]);
  }

  async function click(element: HTMLElement) {
    element.click();
    await fixture.whenStable();
  }

  function button(text: string) {
    return Array.from(page.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;
  }

  async function search(text: string) {
    const input = page.querySelector<HTMLInputElement>('input[aria-label="Search by name or description"]')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('lists the categories in a table, with their number of products, and links to New category', () => {
    expect(rows()).toEqual([
      ['1', 'Microscopes', 'Upright and stereo microscopes', '2'],
      ['2', 'Optics', 'Objectives, eyepieces and cameras', '3'],
      ['4', 'Lenses', 'Spectacle lenses', '0'],
      ['5', 'Filters', 'Filter sets', '0'],
    ]);
    expect(page.querySelector('tbody a.name')?.getAttribute('href')).toBe('/categories/1');
    expect(page.querySelector('a.button.primary')?.getAttribute('href')).toBe('/categories/new');
  });

  it('filters by name or description while typing', async () => {
    await search('OPT');
    expect(names()).toEqual(['Optics']);

    await search('spectacle');
    expect(names()).toEqual(['Lenses']);
  });

  it('shows only the empty categories while Empty only is pressed in the Filters row', async () => {
    const filters = Array.from(page.querySelectorAll('button')).find((b) => b.textContent?.includes('Filters'))!;
    expect(page.querySelector('.filter-bar')).toBeNull();

    await click(filters);
    expect(filters.getAttribute('aria-expanded')).toBe('true');
    const emptyOnly = page.querySelector<HTMLButtonElement>('.filter-bar button[aria-pressed]')!;
    expect(emptyOnly.textContent?.trim()).toBe('Empty only');
    expect(emptyOnly.getAttribute('aria-pressed')).toBe('false');

    await click(emptyOnly);

    expect(emptyOnly.getAttribute('aria-pressed')).toBe('true');
    expect(names()).toEqual(['Lenses', 'Filters']);
    expect(page.querySelector('.badge')?.textContent?.trim()).toBe('1');

    await click(button('Clear filters'));

    expect(emptyOnly.getAttribute('aria-pressed')).toBe('false');
    expect(names().length).toBe(4);
    expect(page.querySelector('.badge')).toBeNull();
  });

  it('sorts by the number of products, and reverses on a second click', async () => {
    const heading = Array.from(page.querySelectorAll('th')).find((th) => th.textContent?.trim() === 'Products')!;

    await click(heading.querySelector('button')!);
    expect(names()).toEqual(['Lenses', 'Filters', 'Microscopes', 'Optics']);

    await click(heading.querySelector('button')!);
    expect(names()).toEqual(['Optics', 'Microscopes', 'Filters', 'Lenses']);
  });

  it('says when nothing matches, and Clear search shows everything again', async () => {
    await search('nothing like this');
    expect(page.textContent).toContain('No categories match your search');

    await click(button('Clear search'));

    expect(names().length).toBe(4);
  });

  it('opens a category from Edit in its row menu', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await click(page.querySelector<HTMLButtonElement>('button[aria-label="Actions for Optics"]')!);
    await click(button('Edit'));

    expect(navigate).toHaveBeenCalledWith(['/categories', 2]);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('deletes from the row menu, moving the products to Uncategorized when there are any', async () => {
    const askToDelete = vi.spyOn(TestBed.inject(Confirmation), 'askToDelete').mockResolvedValue(true);

    await click(page.querySelector<HTMLButtonElement>('button[aria-label="Actions for Optics"]')!);
    await click(page.querySelector<HTMLButtonElement>('.menu button.danger')!);

    expect(askToDelete).toHaveBeenCalledWith('"Optics"', 3);
    expect(service.deleteCategory).toHaveBeenCalledWith(2, true);
    expect(TestBed.inject(Notice).text()).toBe('Optics deleted, 3 products moved to Uncategorized');

    await click(page.querySelector<HTMLButtonElement>('button[aria-label="Actions for Lenses"]')!);
    await click(page.querySelector<HTMLButtonElement>('.menu button.danger')!);

    expect(askToDelete).toHaveBeenCalledWith('"Lenses"', 0);
    expect(service.deleteCategory).toHaveBeenCalledWith(4, false);
    expect(TestBed.inject(Notice).text()).toBe('Lenses deleted');
  });

  async function tick(...names: string[]) {
    for (const name of names) {
      page.querySelector<HTMLInputElement>(`input[aria-label="Select ${name}"]`)!.click();
    }
    await fixture.whenStable();
  }

  it('shows the selection bar while rows are ticked, and its close button clears the ticks', async () => {
    await tick('Lenses', 'Filters');

    expect(page.querySelector('.selection-bar .count')?.textContent).toBe('2 selected');

    await click(page.querySelector<HTMLButtonElement>('button[aria-label="Clear selection"]')!);

    expect(page.querySelector('.selection-bar')).toBeNull();
    expect(page.querySelectorAll('tbody input[type=checkbox]:checked').length).toBe(0);
  });

  it('deletes the ticked empty categories after one dialog', async () => {
    const askToDelete = vi.spyOn(TestBed.inject(Confirmation), 'askToDelete').mockResolvedValue(true);
    await tick('Lenses', 'Filters');

    await click(page.querySelector<HTMLButtonElement>('.selection-bar button.danger')!);

    expect(askToDelete).toHaveBeenCalledWith('2 categories', 0);
    expect(service.deleteCategory).toHaveBeenCalledWith(4, false);
    expect(service.deleteCategory).toHaveBeenCalledWith(5, false);
    expect(TestBed.inject(Notice).text()).toBe('2 categories deleted');
    expect(page.querySelector('.selection-bar')).toBeNull();
  });

  it('deletes ticked categories that have products by moving their products to Uncategorized', async () => {
    const askToDelete = vi.spyOn(TestBed.inject(Confirmation), 'askToDelete').mockResolvedValue(true);
    await tick('Microscopes', 'Optics', 'Lenses');

    await click(page.querySelector<HTMLButtonElement>('.selection-bar button.danger')!);

    expect(askToDelete).toHaveBeenCalledWith('3 categories', 5);
    expect(service.deleteCategory).toHaveBeenCalledWith(1, true);
    expect(service.deleteCategory).toHaveBeenCalledWith(2, true);
    expect(service.deleteCategory).toHaveBeenCalledWith(4, false);
    expect(TestBed.inject(Notice).text()).toBe('3 categories deleted, 5 products moved to Uncategorized');
  });

  it('offers no checkbox and no Delete for Uncategorized', async () => {
    service.getCategories.mockReturnValueOnce(
      of([...categories, { id: 6, name: 'Uncategorized', description: 'Products without a category', productCount: 1, isUncategorized: true }]),
    );
    fixture = TestBed.createComponent(CategoryList);
    page = fixture.nativeElement;
    await fixture.whenStable();

    expect(page.querySelector('input[aria-label="Select Uncategorized"]')).toBeNull();
    await click(page.querySelector<HTMLButtonElement>('button[aria-label="Actions for Uncategorized"]')!);
    expect(Array.from(page.querySelectorAll('.menu button')).map((b) => b.textContent?.trim())).toEqual(['Edit']);
  });

  it('does not open a category when its checkbox is clicked', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await tick('Lenses');

    expect(navigate).not.toHaveBeenCalled();
  });
});
