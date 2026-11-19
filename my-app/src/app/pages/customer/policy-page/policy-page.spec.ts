import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideRouter, RouterModule } from '@angular/router';
import { PolicyPage } from './policy-page';

describe('PolicyPage', () => {
  it('creates the page', async () => {
    await TestBed.configureTestingModule({
      declarations: [PolicyPage],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(PolicyPage);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
