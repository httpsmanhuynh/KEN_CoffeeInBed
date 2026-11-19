import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideRouter, RouterModule } from '@angular/router';
import { JourneysPage } from './journeys-page';

describe('JourneysPage', () => {
  it('creates the page', async () => {
    await TestBed.configureTestingModule({
      declarations: [JourneysPage],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(JourneysPage);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
