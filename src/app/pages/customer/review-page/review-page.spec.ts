import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideRouter, RouterModule } from '@angular/router';
import { ReviewPage } from './review-page';

describe('ReviewPage', () => {
  it('creates the page', async () => {
    await TestBed.configureTestingModule({
      declarations: [ReviewPage],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(ReviewPage);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
