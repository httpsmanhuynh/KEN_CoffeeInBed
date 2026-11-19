import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideRouter, RouterModule } from '@angular/router';
import { CoinsPage } from './coins-page';

describe('CoinsPage', () => {
  it('creates the page', async () => {
    await TestBed.configureTestingModule({
      declarations: [CoinsPage],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(CoinsPage);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
