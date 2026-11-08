import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideRouter, RouterModule } from '@angular/router';
import { AboutPage } from './about-page';

describe('AboutPage', () => {
  it('creates the page', async () => {
    await TestBed.configureTestingModule({
      declarations: [AboutPage],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(AboutPage);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
