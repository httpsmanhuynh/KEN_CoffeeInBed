import { TestBed } from '@angular/core/testing';
import { RouterModule, Router } from '@angular/router';
import { SuggestionPopup } from './suggestion-popup';
import { SuggestionPopupService } from '../../services/suggestion-popup.service';

describe('SuggestionPopup', () => {
  let c: SuggestionPopup;
  let svc: SuggestionPopupService;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([])],
      declarations: [SuggestionPopup],
    }).compileComponents();
    const f = TestBed.createComponent(SuggestionPopup);
    c = f.componentInstance;
    svc = TestBed.inject(SuggestionPopupService);
  });

  it('shows 2 slides with the design copy and wraps around', () => {
    expect(c.slides.length).toBe(2);
    expect(c.counter).toBe('01 / 02 · Gợi ý buổi chiều');
    c.next();
    expect(c.counter).toBe('02 / 02 · Gợi ý buổi chiều');
    expect(c.current[0].price).toBe('45.000đ');
    c.next();
    expect(c.index).toBe(0);
    c.prev();
    expect(c.index).toBe(1);
  });

  it('fills the progress bars by slide position', () => {
    c.next(); c.progress = 0.5;
    expect([c.fill(0), c.fill(1)]).toEqual([100, 50]);
  });

  it('close() hides the popup and remembers it was seen', () => {
    svc.show();
    c.close();
    expect(svc.isOpen()).toBe(false);
    expect(sessionStorage.getItem('ken.afternoonPopupSeen')).toBe('1');
  });

  it('explore() closes and goes to /top-trending; later() goes to /menu', () => {
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    svc.show(); c.explore();
    expect(nav).toHaveBeenCalledWith('/top-trending');
    expect(svc.isOpen()).toBe(false);
    c.later();
    expect(nav).toHaveBeenCalledWith('/menu');
  });
});
