import { Component } from '@angular/core';

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'noshow';
type StatusFilter = 'all' | BookingStatus;

interface Booking {
  id: string; space: string; zone: string;
  date: string;            // ISO yyyy-mm-dd
  time: string;            // "13:00–15:00 · 2 giờ · 01 khách"
  pkg: string; total: number; status: BookingStatus;
}

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', completed: 'Hoàn thành',
  cancelled: 'Đã huỷ', noshow: 'Không đến',
};

const INTRO: Record<StatusFilter, string> = {
  all: 'Những khoảng thời gian bạn đã dành cho mình, được KÉN lưu lại ở đây.',
  pending: 'Các lịch hẹn đang được KÉN kiểm tra. Bạn có thể theo dõi bước tiếp theo ngay bên dưới.',
  confirmed: 'Những lịch hẹn đã được KÉN giữ chỗ cho bạn.',
  completed: 'Những lần ghé KÉN bạn đã hoàn thành.',
  cancelled: 'Các lịch hẹn đã được huỷ.',
  noshow: 'Các lịch hẹn bạn chưa kịp ghé.',
};

@Component({
  selector: 'app-booking-list',
  standalone: false,
  styleUrl: './booking-list.css',
  templateUrl: './booking-list.html',
})
export class BookingList {
  readonly statusLabel = STATUS_LABEL;

  // TODO: thay bằng API. Hai đơn "Chờ xác nhận" lấy đúng theo Figma; các đơn còn lại là dữ liệu minh hoạ.
  readonly bookings: Booking[] = [
    { id: '#KEN-261026-009', space: 'KÉN nghỉ đơn', zone: 'KÉN Nghỉ Ngơi', date: '2026-10-26', time: '13:00–15:00 · 2 giờ · 01 khách', pkg: '2h · 90K', total: 90000, status: 'pending' },
    { id: '#KEN-251026-024', space: 'Phòng họp nhỏ', zone: 'KÉN Tập Trung', date: '2026-10-25', time: '14:00–17:00 · 3 giờ · 04 khách', pkg: 'Họp nhóm nhỏ', total: 480000, status: 'pending' },
    { id: '#KEN-241026-006', space: 'Ô tập trung cá nhân', zone: 'KÉN Tập Trung', date: '2026-10-24', time: '09:00–13:00 · 4 giờ · 01 khách', pkg: 'Nửa ngày · 4h', total: 140000, status: 'confirmed' },
    { id: '#KEN-221026-018', space: 'Ô tập trung cá nhân', zone: 'KÉN Tập Trung', date: '2026-10-22', time: '09:00–13:00 · 4 giờ · 01 khách', pkg: 'Nửa ngày + up-size', total: 145000, status: 'completed' },
    { id: '#KEN-181026-011', space: 'KÉN nghỉ đơn', zone: 'KÉN Nghỉ Ngơi', date: '2026-10-18', time: '15:00–17:00 · 2 giờ · 01 khách', pkg: '2h · 90K', total: 90000, status: 'completed' },
    { id: '#KEN-151026-003', space: 'Khu làm việc chung', zone: 'KÉN Tập Trung', date: '2026-10-15', time: '08:00–10:00 · 2 giờ · 01 khách', pkg: 'Linh hoạt · 2h', total: 80000, status: 'cancelled' },
    { id: '#KEN-091026-002', space: 'Khu làm việc chung', zone: 'KÉN Tập Trung', date: '2026-10-09', time: '08:00–10:00 · 2 giờ · 01 khách', pkg: 'Linh hoạt · 2h', total: 80000, status: 'noshow' },
  ];

  readonly tabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'pending', label: 'Chờ xác nhận' },
    { key: 'confirmed', label: 'Đã xác nhận' },
    { key: 'completed', label: 'Hoàn thành' },
    { key: 'cancelled', label: 'Đã huỷ' },
    { key: 'noshow', label: 'Không đến' },
  ];

  // Mặc định mở tab "Chờ xác nhận" và khoảng 01/10–31/10/2026 như thiết kế Figma.
  status: StatusFilter = 'pending';
  fromDate = '2026-10-01';
  toDate = '2026-10-31';
  private applied = { from: this.fromDate, to: this.toDate };

  get intro(): string { return INTRO[this.status]; }

  count(key: StatusFilter): number {
    return key === 'all' ? this.bookings.length : this.bookings.filter(b => b.status === key).length;
  }

  get rows(): Booking[] {
    return this.bookings.filter(b =>
      (this.status === 'all' || b.status === this.status) &&
      b.date >= this.applied.from && b.date <= this.applied.to);
  }

  get footnote(): string {
    const n = this.rows.length;
    const label = this.status === 'all' ? 'đơn' : `đơn ${STATUS_LABEL[this.status as BookingStatus].toLowerCase()}`;
    return `Đã hiển thị ${n} / ${n} ${label}.`;
  }

  setStatus(key: StatusFilter): void { this.status = key; }
  applyFilter(): void {
    // Nếu người dùng chọn ngược khoảng, hoán đổi để tránh danh sách trống khó hiểu.
    if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
      [this.fromDate, this.toDate] = [this.toDate, this.fromDate];
    }
    this.applied = { from: this.fromDate || '0000-00-00', to: this.toDate || '9999-12-31' };
  }

  fmtDate(iso: string): string { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
  fmtMoney(n: number): string { return n.toLocaleString('vi-VN') + 'đ'; }
  logout(): void { console.log('Đăng xuất'); } // TODO: gọi AuthService.logout()
  trackById(_: number, b: Booking): string { return b.id; }
}
