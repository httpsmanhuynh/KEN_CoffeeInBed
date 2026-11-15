import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideRouter, RouterModule } from '@angular/router';
import { SpacesPage } from './spaces-page';

describe('SpacesPage', () => {
  it('creates the page and removes the explore spaces button', async () => {
    await TestBed.configureTestingModule({
      declarations: [SpacesPage],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(SpacesPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    expect(page).toBeTruthy();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Khám phá các không gian');
  });

  it('filters spaces when selecting KÉN zones', async () => {
    await TestBed.configureTestingModule({
      declarations: [SpacesPage],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(SpacesPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;

    expect(page.filteredSpaces.length).toBe(8);
    page.selectZone('connect');
    expect(page.activeZone).toBe('connect');
    expect(page.filteredSpaces.map((s) => s.id)).toEqual(['connect']);

    page.selectZone('focus');
    expect(page.filteredSpaces.map((s) => s.id)).toEqual(['cowork', 'focus', 'meeting', 'boardroom']);

    page.selectZone('rest');
    expect(page.filteredSpaces.map((s) => s.id)).toEqual(['single', 'double', 'private']);

    page.selectZone('rest');
    expect(page.activeZone).toBe('all');
    expect(page.filteredSpaces.length).toBe(8);
  });
});
