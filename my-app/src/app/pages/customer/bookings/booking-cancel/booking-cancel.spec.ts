import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, convertToParamMap, RouterModule } from '@angular/router';
import { BookingCancel } from './booking-cancel';

function setup(code: string | null) {
  TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([])],
    declarations: [BookingCancel],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(code ? { code } : {}) } } }],
  });
  return TestBed.createComponent(BookingCancel).componentInstance;
}

describe('BookingCancel', () => {
  it('defaults to the confirmed booking from the design', () => {
    const c = setup(null);
    expect(c.order!.code).toBe('#KEN-241026-006');
    expect(c.isConfirmed).toBe(true);
    expect(c.conditionLine).toContain('Cut-off Time');
    expect(c.paidText.replace(/\s/g, '')).toMatch(/^140[.,\u202f]?000đ$/);
  });

  it('picks the order from ?code= and switches the wording for pending orders', () => {
    const c = setup('KEN-261026-009');
    expect(c.order!.name).toBe('KÉN nghỉ đơn');
    expect(c.isConfirmed).toBe(false);
    expect(c.paidText).toBe('Chờ đối chiếu');
  });

  it('only submits once', () => {
    const c = setup(null);
    c.confirmCancel();
    expect(c.submitted).toBe(true);
  });
});
