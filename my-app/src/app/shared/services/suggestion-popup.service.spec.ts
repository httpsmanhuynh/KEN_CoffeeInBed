import { TestBed } from '@angular/core/testing';
import { SuggestionPopupService } from './suggestion-popup.service';

describe('SuggestionPopupService', () => {
  let svc: SuggestionPopupService;
  beforeEach(() => { sessionStorage.clear(); svc = TestBed.inject(SuggestionPopupService); });

  it('treats 14:00–16:59 as afternoon', () => {
    expect(svc.isAfternoon(new Date(2026, 9, 25, 14, 0))).toBe(true);
    expect(svc.isAfternoon(new Date(2026, 9, 25, 16, 59))).toBe(true);
    expect(svc.isAfternoon(new Date(2026, 9, 25, 13, 59))).toBe(false);
    expect(svc.isAfternoon(new Date(2026, 9, 25, 17, 0))).toBe(false);
  });

  it('force opens the popup regardless of time', () => {
    svc.autoShow(true);
    expect(svc.isOpen()).toBe(true);
  });

  it('does not auto-open again once marked as seen', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 25, 15, 0));
    svc.autoShow();
    expect(svc.isOpen()).toBe(true);
    svc.markSeen(); svc.hide();
    svc.autoShow();
    expect(svc.isOpen()).toBe(false);
    vi.useRealTimers();
  });
});
