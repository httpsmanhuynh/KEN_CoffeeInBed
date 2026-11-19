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

  it('should create', () => expect(component).toBeTruthy());

  it('defaults to "Đặt gần nhất ↓" sorted by createdAtMs descending', () => {
    component.bookings = [
      { id: '#OLD', space: 'A', zone: 'Z', date: '2026-11-20', time: '09:00–11:00', pkg: '2 giờ', total: 100000, status: 'confirmed', createdAtMs: 1000, createdAt: '2026-11-18T01:00:00.000Z' },
      { id: '#NEW', space: 'B', zone: 'Z', date: '2026-11-19', time: '09:00–11:00', pkg: '2 giờ', total: 100000, status: 'pending', createdAtMs: 2000, createdAt: '2026-11-19T01:00:00.000Z' },
    ];
    expect(component.status).toBe('all');
    expect(component.summary).toBe('2 đơn đặt chỗ · Sắp xếp theo thời gian đặt');
    expect(component.sortLabel).toBe('Đặt gần nhất ↓');
    expect(component.rows.map(r => r.id)).toEqual(['#NEW', '#OLD']);
  });

  it('toggling sort switches to "Đặt xa nhất ↑" and reverses the order', () => {
    component.bookings = [
      { id: '#OLD', space: 'A', zone: 'Z', date: '2026-11-20', time: '09:00–11:00', pkg: '2 giờ', total: 100000, status: 'confirmed', createdAtMs: 1000 },
      { id: '#NEW', space: 'B', zone: 'Z', date: '2026-11-19', time: '09:00–11:00', pkg: '2 giờ', total: 100000, status: 'pending', createdAtMs: 2000 },
    ];
    component.toggleSort();
    expect(component.sortLabel).toBe('Đặt xa nhất ↑');
    expect(component.rows.map(r => r.id)).toEqual(['#OLD', '#NEW']);
  });

  it('formats date and money like the design', () => {
    expect(component.fmtDate('2026-10-26')).toBe('26/10/2026');
    expect(component.fmtMoney(90000).replace(/\s/g, '')).toMatch(/^90[.,\u202f]?000đ$/);
  });
});
