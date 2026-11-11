import { KenFocusPodPage } from './focus-pod';
import { KenBookingState } from '../booking-state';
import { Router } from '@angular/router';
import { vi } from 'vitest';

describe('KenFocusPodPage', () => {
  it('exports the Angular component', () => {
    expect(KenFocusPodPage).toBeDefined();
  });

  it('opens the separate drink selection page', () => {
    const navigateByUrl = vi.fn();
    const page = new KenFocusPodPage(new KenBookingState(), { navigateByUrl } as unknown as Router);

    page.openDrinkPicker();

    expect(navigateByUrl).toHaveBeenCalledWith('/booking/drinks');
  });
});