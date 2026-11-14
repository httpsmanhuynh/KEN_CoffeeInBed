import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideRouter, RouterModule } from '@angular/router';
import { SmoothScrollService } from '../../../../core/smooth-scroll.service';
import { KenCafeCatalogPage } from './cafe-catalog';

describe('KenCafeCatalogPage', () => {
  it('scrolls to menu catalog when scrollToMenu is called', async () => {
    const smoothScroll = { scrollTo: vi.fn() };
    await TestBed.configureTestingModule({
      declarations: [KenCafeCatalogPage],
      imports: [CommonModule, FormsModule, RouterModule],
      providers: [
        provideRouter([]),
        { provide: SmoothScrollService, useValue: smoothScroll },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(KenCafeCatalogPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const preventDefault = vi.fn();

    page.scrollToMenu({ preventDefault } as unknown as Event);
    expect(preventDefault).toHaveBeenCalled();
    expect(smoothScroll.scrollTo).toHaveBeenCalledWith('#ken-cafe-menu', { offset: -88, duration: 0.9 });
  });
});