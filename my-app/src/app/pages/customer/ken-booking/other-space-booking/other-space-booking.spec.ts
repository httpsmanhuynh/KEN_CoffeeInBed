import { KenOtherSpacePage } from './other-space-booking';
import { KenBookingState, kenNextDay } from '../booking-state';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

describe('KenOtherSpacePage', () => {
  it('exports the booking component', () => {
    expect(KenOtherSpacePage).toBeDefined();
  });

  it('stores the selected space, schedule, and guest drink quantities before reviewing', () => {
    const state = new KenBookingState();
    const route = {
      paramMap: of(convertToParamMap({ id: 'private' })),
    } as ActivatedRoute;
    const navigateByUrl = vi.fn();
    const router = { navigateByUrl } as unknown as Router;
    const page = new KenOtherSpacePage(route, router, state);
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
    const route = { paramMap: of(convertToParamMap({ id: 'private' })) } as ActivatedRoute;
    const navigateByUrl = vi.fn();
    const page = new KenOtherSpacePage(route, { navigateByUrl } as unknown as Router, state);

    page.openDrinkPicker();

    expect(navigateByUrl).toHaveBeenCalledWith('/booking/drinks');
  });
});
