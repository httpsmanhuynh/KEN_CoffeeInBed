import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BookingList } from './booking-list';

describe('BookingList', () => {
  let component: BookingList;
  let fixture: ComponentFixture<BookingList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormsModule, RouterModule.forRoot([])],
      declarations: [BookingList],
      schemas: [NO_ERRORS_SCHEMA], // app-account-sidebar được khai báo ở AppModule
    }).compileComponents();

    fixture = TestBed.createComponent(BookingList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens on the pending tab with the 2 pending bookings from the design', () => {
    expect(component.status).toBe('pending');
    expect(component.rows.length).toBe(2);
    expect(component.footnote).toBe('Đã hiển thị 2 / 2 đơn chờ xác nhận.');
  });

  it('shows every booking on the "all" tab', () => {
    component.setStatus('all');
    expect(component.rows.length).toBe(7);
  });

  it('formats date and money like the design', () => {
    expect(component.fmtDate('2026-10-26')).toBe('26/10/2026');
    expect(component.fmtMoney(90000).replace(/\s/g, '')).toMatch(/^90[.,\u202f]?000đ$/);
  });
});
