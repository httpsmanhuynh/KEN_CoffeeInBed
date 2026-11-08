import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideRouter, RouterModule } from '@angular/router';
import { ConnectPage } from './connect-page';

describe('ConnectPage', () => {
  it('creates the page', async () => {
    await TestBed.configureTestingModule({
      declarations: [ConnectPage],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(ConnectPage);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
