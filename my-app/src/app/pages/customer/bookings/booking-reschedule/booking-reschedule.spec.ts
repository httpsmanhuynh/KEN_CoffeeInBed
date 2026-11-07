import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BookingReschedule } from './booking-reschedule';

describe('BookingReschedule', () => {
  let component: BookingReschedule;
  let fixture: ComponentFixture<BookingReschedule>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormsModule, RouterModule.forRoot([])],
      declarations: [BookingReschedule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(BookingReschedule);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => expect(component).toBeTruthy());

  it('matches the design defaults (25/10, 09:00 + 4h = 13:00, Chủ nhật)', () => {
    expect(component.end).toBe('13:00');
    expect(component.proposedTitle).toBe('Chủ nhật, 25/10');
    expect(component.availability).toBe('ok');
  });

  it('flags a schedule identical to the current one', () => {
    component.newDate = '2026-10-24';
    expect(component.availability).toBe('same');
  });

  it('requires the acknowledgement before submitting', () => {
    expect(component.canSubmit).toBeFalse();
    component.acknowledged = true;
    expect(component.canSubmit).toBeTrue();
    component.confirm();
    expect(component.submitted).toBeTrue();
  });

  it('selecting another order resets the form to that order', () => {
    component.select('o3');
    expect(component.hours).toBe(3);
    expect(component.newDate).toBe('2026-10-26');
    expect(component.acknowledged).toBeFalse();
  });
});
