import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideRouter, RouterModule } from '@angular/router';
import { PointsPage } from './points-page';

describe('PointsPage', () => {
  it('creates the page', async () => {
    await TestBed.configureTestingModule({
      declarations: [PointsPage],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(PointsPage);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
