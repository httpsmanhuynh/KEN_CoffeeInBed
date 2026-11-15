import { KenOtherSpacePage } from './other-space-booking';
import { ChangeDetectorRef } from '@angular/core';
import { KenBookingState, kenNextDay } from '../booking-state';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { AuthService } from '../../../../core/auth.service';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { KenAvailabilityService } from '../availability.service';

describe('KenOtherSpacePage', () => {
  function availabilityService(): KenAvailabilityService {
    return {
      check: () => of([{
        name: 'Phòng riêng tư',
        isAvailable: true,
        packages: [{ durationHours: 1, isAvailable: true }],
      }]),
      forSpace: (_id: string, spaces: Array<{ name: string }>) => spaces[0],
      packageAvailable: () => true,
    } as unknown as KenAvailabilityService;
  }

  it('exports the booking component', () => {
    expect(KenOtherSpacePage).toBeDefined();
  });

  it('stores the selected space, schedule, and guest drink quantities before reviewing', () => {
    const state = new KenBookingState();
    const route = {
      paramMap: of(convertToParamMap({ id: 'private' })),
      snapshot: { queryParamMap: convertToParamMap({}) },
    } as ActivatedRoute;
    const navigateByUrl = vi.fn();
    const router = { navigateByUrl } as unknown as Router;
    const auth = { ensureSession: () => of(null) } as unknown as AuthService;
    const page = new KenOtherSpacePage(
      route, router, state, auth, availabilityService(),
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef,
    );
    page.ngOnInit();
    page.date = kenNextDay();
    page.guests = 4;
    page.duration = 4;
    page.startHour = 10;
    state.set({ date: page.date, guests: 4, hours: 4, startHour: 10 });
    state.setDrinkQuantity('coffee', 4);

    page.toReview();

    expect(state.draft()).toMatchObject({
      spaceId: 'private',
      guests: 4,
      hours: 4,
      startHour: 10,
    });
    expect(state.selectedDrinkCount).toBe(4);
    expect(navigateByUrl).toHaveBeenCalledWith('/booking/review');
  });

  it('opens the separate drink selection page', () => {
    const state = new KenBookingState();
    const route = {
      paramMap: of(convertToParamMap({ id: 'private' })),
      snapshot: { queryParamMap: convertToParamMap({}) },
    } as ActivatedRoute;
    const navigate = vi.fn();
    const navigateByUrl = vi.fn();
    const auth = { ensureSession: () => of(null) } as unknown as AuthService;
    const page = new KenOtherSpacePage(
      route, { navigate, navigateByUrl } as unknown as Router, state, auth, availabilityService(),
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef,
    );

    page.openDrinkPicker();

    expect(navigate).toHaveBeenCalledWith(['/booking/drinks'], {
      queryParams: { returnTo: '/booking/private?bookingStep=addons' },
    });
  });

  it('returns a guest to the add-ons step after login', () => {
    const state = new KenBookingState();
    const route = {
      paramMap: of(convertToParamMap({ id: 'private' })),
      snapshot: { queryParamMap: convertToParamMap({}) },
    } as ActivatedRoute;
    const navigate = vi.fn();
    const auth = { ensureSession: () => of(null) } as unknown as AuthService;
    const router = { navigate, url: '/booking/private' } as unknown as Router;
    const page = new KenOtherSpacePage(
      route, router, state, auth, availabilityService(),
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef,
    );
    page.ngOnInit();

    page.beginBooking();

    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/booking/private?bookingStep=addons' },
    });
  });
});
