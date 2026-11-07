import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideRouter, RouterModule } from '@angular/router';
import { SpacesPage } from './spaces-page';

describe('SpacesPage', () => {
  it('creates the page', async () => {
    await TestBed.configureTestingModule({
      declarations: [SpacesPage],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(SpacesPage);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
