import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookingReschedule } from './booking-reschedule';

describe('BookingReschedule', () => {
  let component: BookingReschedule;
  let fixture: ComponentFixture<BookingReschedule>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BookingReschedule],
    }).compileComponents();

    fixture = TestBed.createComponent(BookingReschedule);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
