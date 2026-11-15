import { describe, it, expect } from 'vitest';
import '@angular/compiler';
import { KenDrinkPickerPage } from './drink-picker';
import { KenBookingState, kenNextDay } from '../booking-state';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { vi } from 'vitest';

describe('KenDrinkPickerPage', () => {
  it('exports the Angular component', () => {
    expect(KenDrinkPickerPage).toBeDefined();
  });

  it('requires one drink per guest and returns to that space to select add-ons', () => {
    const state = new KenBookingState();
    state.set({ spaceId: 'private', date: kenNextDay(), guests: 4, hours: 4 });
    const navigateByUrl = vi.fn();
    const router = { navigateByUrl } as unknown as Router;
    const route = { snapshot: { queryParamMap: convertToParamMap({}) } } as ActivatedRoute;
    const page = new KenDrinkPickerPage(state, router, route);

    page.select('coffee');
    page.select('water');
    expect(page.canContinue).toBe(false);
    expect(state.selectedDrinkCount).toBe(2);

    page.select('matcha');
    page.select('juice');
    expect(page.canContinue).toBe(true);

    page.back();

    expect(state.draft().extras).toEqual({});
    expect(navigateByUrl).toHaveBeenCalledWith('/booking/private');
  });

  it('requires exactly two drinks for a two-person booking', () => {
    const state = new KenBookingState();
    state.set({ spaceId: 'double', date: kenNextDay(), guests: 2, hours: 2 });
    const route = { snapshot: { queryParamMap: convertToParamMap({}) } } as ActivatedRoute;
    const page = new KenDrinkPickerPage(state, { navigateByUrl: vi.fn() } as unknown as Router, route);

    page.select('coffee');
    expect(page.canContinue).toBe(false);
    page.select('water');

    expect(state.selectedDrinkCount).toBe(2);
    expect(page.canContinue).toBe(true);
  });

  it('returns to Focus Pod after confirming its included drink', () => {
    const state = new KenBookingState();
    state.set({ spaceId: 'focus', hours: 4 });
    const navigateByUrl = vi.fn();
    const route = { snapshot: { queryParamMap: convertToParamMap({}) } } as ActivatedRoute;
    const page = new KenDrinkPickerPage(state, { navigateByUrl } as unknown as Router, route);

    page.select('coffee');
    page.back();

    expect(navigateByUrl).toHaveBeenCalledWith('/booking/focus-pod');
  });

  it('loads AI recommendations upon initialization', () => {
    const state = new KenBookingState();
    state.set({ spaceId: 'focus', startHour: 14, hours: 4 });
    const route = { snapshot: { queryParamMap: convertToParamMap({}) } } as ActivatedRoute;
    const page = new KenDrinkPickerPage(state, { navigateByUrl: vi.fn() } as unknown as Router, route);
    page.ngOnInit();
    expect(page.recommendations.length).toBeGreaterThan(0);
    expect(page.recommendations[0].matchScore).toBeGreaterThan(80);
  });
});
