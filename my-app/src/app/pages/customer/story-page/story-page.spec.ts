import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideRouter, RouterModule } from '@angular/router';
import { StoryPage } from './story-page';

describe('StoryPage', () => {
  it('creates the page', async () => {
    await TestBed.configureTestingModule({
      declarations: [StoryPage],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(StoryPage);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
