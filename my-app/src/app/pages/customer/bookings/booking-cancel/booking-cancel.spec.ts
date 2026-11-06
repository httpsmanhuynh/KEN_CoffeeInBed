import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookingCancel } from './booking-cancel';

describe('BookingCancel', () => {
  let component: BookingCancel;
  let fixture: ComponentFixture<BookingCancel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BookingCancel],
    }).compileComponents();

    fixture = TestBed.createComponent(BookingCancel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
