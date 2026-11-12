import { KenFocusPodPage } from './focus-pod';
import { KenBookingState } from '../booking-state';
import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { AuthService } from '../../../../core/auth.service';
import { of } from 'rxjs';
import { KenAvailabilityService } from '../availability.service';
import { vi } from 'vitest';

describe('KenFocusPodPage', () => {
  function availabilityService(): KenAvailabilityService {
    return {
      check: () => of([{
        name: 'Ô tập trung cá nhân',
        isAvailable: true,
        packages: [{ durationHours: 4, isAvailable: true }],
      }]),
      forSpace: (_id: string, spaces: Array<{ name: string }>) => spaces[0],
      packageAvailable: () => true,
    } as unknown as KenAvailabilityService;
  }

  it('exports the Angular component', () => {
    expect(KenFocusPodPage).toBeDefined();
  });

  it('opens the separate drink selection page', () => {
    const navigate = vi.fn();
    const auth = { ensureSession: () => of(null) } as unknown as AuthService;
    const route = { snapshot: { queryParamMap: convertToParamMap({}) } } as ActivatedRoute;
    const page = new KenFocusPodPage(
      new KenBookingState(), { navigate } as unknown as Router, auth, route, availabilityService(),
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef,
    );

    page.openDrinkPicker();

    expect(navigate).toHaveBeenCalledWith(['/booking/drinks'], {
      queryParams: { returnTo: '/booking/focus-pod?bookingStep=addons' },
    });
  });

  it('returns a guest to the add-ons step after login', () => {
    const navigate = vi.fn();
    const auth = { ensureSession: () => of(null) } as unknown as AuthService;
    const route = { snapshot: { queryParamMap: convertToParamMap({}) } } as ActivatedRoute;
    const router = { navigate, url: '/booking/focus-pod' } as unknown as Router;
    const page = new KenFocusPodPage(
      new KenBookingState(), router, auth, route, availabilityService(),
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef,
    );

    page.beginBooking();

    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/booking/focus-pod?bookingStep=addons' },
    });
  });
});