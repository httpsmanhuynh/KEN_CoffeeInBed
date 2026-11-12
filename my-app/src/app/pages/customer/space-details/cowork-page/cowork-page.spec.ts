import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideRouter, RouterModule } from '@angular/router';
import { CoworkPage } from './cowork-page';

describe('CoworkPage', () => {
  it('creates the page', async () => {
    await TestBed.configureTestingModule({
      declarations: [CoworkPage],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(CoworkPage);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
