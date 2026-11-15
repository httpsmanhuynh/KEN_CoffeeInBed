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

  it('opens on "Tất cả" with the 7 bookings from the design, newest first', () => {
    expect(component.status).toBe('all');
    expect(component.rows.length).toBe(7);
    expect(component.rows[0].id).toBe('#KEN-261026-009');
    expect(component.summary).toBe('7 đơn đặt chỗ · Sắp xếp theo ngày sử dụng');
    expect(component.footnote).toBe('Đã hiển thị 7 / 7 đơn');
    expect(component.sortLabel).toBe('Mới nhất ↓');
  });

  it('tab counts match the design', () => {
    expect(component.tabs.map(t => `${t.label} (${component.count(t.key)})`)).toEqual([
      'Tất cả (7)', 'Chờ xác nhận (2)', 'Đã xác nhận (1)', 'Hoàn thành (2)', 'Đã huỷ (1)', 'Không đến (1)',
    ]);
  });

  it('pending tab shows the 2 pending bookings', () => {
    component.setStatus('pending');
    expect(component.rows.length).toBe(2);
    expect(component.footnote).toBe('Đã hiển thị 2 / 2 đơn chờ xác nhận');
  });

  it('toggling sort reverses the order', () => {
    component.toggleSort();
    expect(component.sortLabel).toBe('Cũ nhất ↑');
    expect(component.rows[0].id).toBe('#KEN-121026-005');
  });

  it('date filter narrows the list and swaps a reversed range', () => {
    component.fromDate = '2026-10-31'; component.toDate = '2026-10-23';
    component.applyFilter();
    expect(component.fromDate).toBe('2026-10-23');
    expect(component.rows.map(r => r.id)).toEqual(['#KEN-261026-009', '#KEN-251026-024', '#KEN-241026-006']);
  });

  it('picks the eye icon per status like the design', () => {
    const by = (id: string) => component.bookings.find(b => b.id === id)!;
    expect(component.eyeIcon(by('#KEN-241026-006'))).toBe('eye-view');
    expect(component.eyeIcon(by('#KEN-221026-018'))).toBe('eye-view-fill');
    expect(component.eyeIcon(by('#KEN-151026-003'))).toBe('eye-view-off');
  });

  it('formats date and money like the design', () => {
    expect(component.fmtDate('2026-10-26')).toBe('26/10/2026');
    expect(component.fmtMoney(90000).replace(/\s/g, '')).toMatch(/^90[.,\u202f]?000đ$/);
  });
});
