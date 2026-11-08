import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideRouter, RouterModule } from '@angular/router';
import { MeetingPage } from './meeting-page';

describe('MeetingPage', () => {
  it('creates the page', async () => {
    await TestBed.configureTestingModule({
      declarations: [MeetingPage],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(MeetingPage);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
