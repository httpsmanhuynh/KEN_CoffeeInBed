import { TestBed } from '@angular/core/testing';
import { SuggestionPopupService } from './suggestion-popup.service';

describe('SuggestionPopupService', () => {
  let svc: SuggestionPopupService;
  beforeEach(() => {
    sessionStorage.clear();
    svc = TestBed.inject(SuggestionPopupService);
  });

  it('opens the popup and emits a new open version each time', () => {
    svc.show();
    expect(svc.isOpen()).toBe(true);
    const firstVersion = svc.openVersion();
    svc.show();
    expect(svc.isOpen()).toBe(true);
    expect(svc.openVersion()).toBe(firstVersion + 1);
  });

  it('shows automatically only once per browser session', () => {
    expect(svc.showOncePerSession()).toBe(true);
    expect(svc.isOpen()).toBe(true);
    const firstVersion = svc.openVersion();
    svc.hide();

    expect(svc.showOncePerSession()).toBe(false);
    expect(svc.isOpen()).toBe(false);
    expect(svc.openVersion()).toBe(firstVersion);
  });
});
