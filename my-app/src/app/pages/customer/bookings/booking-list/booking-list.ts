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

const PAGE_SIZE = 10;

@Component({
  selector: 'app-booking-list',
  standalone: false,
  styleUrl: './booking-list.css',
  templateUrl: './booking-list.html',
})
export class BookingList {
  readonly statusLabel = STATUS_LABEL;

  // TODO: thay bằng API. Dữ liệu theo Figma "Lịch sử đặt chỗ — Tất cả" (7 đơn).
  readonly bookings: Booking[] = [
    { id: '#KEN-261026-009', space: 'KÉN nghỉ đơn', zone: 'KÉN Nghỉ Ngơi', date: '2026-10-26', time: '13:00–15:00 · 2 giờ · 01 khách', pkg: 'Gói 2h · 90K', total: 90000, status: 'pending' },
    { id: '#KEN-251026-024', space: 'Phòng họp nhỏ', zone: 'KÉN Tập Trung', date: '2026-10-25', time: '14:00–17:00 · 3 giờ · 04 khách', pkg: 'Họp nhóm nhỏ · 3h', total: 480000, status: 'pending' },
    { id: '#KEN-241026-006', space: 'Ô tập trung cá nhân', zone: 'KÉN Tập Trung', date: '2026-10-24', time: '09:00–13:00 · 4 giờ · 01 khách', pkg: 'Nửa ngày · 4h', total: 140000, status: 'confirmed' },
    { id: '#KEN-221026-018', space: 'Ô tập trung cá nhân', zone: 'KÉN Tập Trung', date: '2026-10-22', time: '09:00–13:00 · 4 giờ · 01 khách', pkg: 'Nửa ngày + up-size', total: 145000, status: 'completed' },
    { id: '#KEN-181026-012', space: 'Phòng họp nhỏ', zone: 'KÉN Tập Trung', date: '2026-10-18', time: '10:00–12:00 · 2 giờ · 04 khách', pkg: 'Họp nhóm nhỏ · 3h', total: 355000, status: 'completed' },
    { id: '#KEN-151026-003', space: 'Khu làm việc chung', zone: 'KÉN Tập Trung', date: '2026-10-15', time: '08:00–10:00 · 2 giờ · 01 khách', pkg: 'Linh hoạt · 2h', total: 80000, status: 'cancelled' },
    { id: '#KEN-121026-005', space: 'KÉN nghỉ đôi', zone: 'KÉN Nghỉ Ngơi', date: '2026-10-12', time: '15:00–17:00 · 2 giờ · 02 khách', pkg: 'Gói 2h · 180K', total: 180000, status: 'noshow' },
  ];

  readonly tabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'pending', label: 'Chờ xác nhận' },
    { key: 'confirmed', label: 'Đã xác nhận' },
    { key: 'completed', label: 'Hoàn thành' },
    { key: 'cancelled', label: 'Đã huỷ' },
    { key: 'noshow', label: 'Không đến' },
  ];

  // Mặc định như Figma: Tất cả, 01/10/2026 – 31/10/2026, mới nhất trước.
  status: StatusFilter = 'all';
  fromDate = '2026-10-01';
  toDate = '2026-10-31';
  newestFirst = true;
  page = 1;
  private applied = { from: this.fromDate, to: this.toDate };

  get intro(): string { return INTRO[this.status]; }

  count(key: StatusFilter): number {
    return key === 'all' ? this.bookings.length : this.bookings.filter(b => b.status === key).length;
  }

  /** Toàn bộ đơn khớp bộ lọc, đã sắp xếp (chưa phân trang). */
  get filtered(): Booking[] {
    const list = this.bookings.filter(b =>
      (this.status === 'all' || b.status === this.status) &&
      b.date >= this.applied.from && b.date <= this.applied.to);
    return list.sort((a, b) => (this.newestFirst ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  }

  get pages(): number { return Math.max(1, Math.ceil(this.filtered.length / PAGE_SIZE)); }
  get rows(): Booking[] {
    const start = (Math.min(this.page, this.pages) - 1) * PAGE_SIZE;
    return this.filtered.slice(start, start + PAGE_SIZE);
  }
  get pageNumbers(): number[] { return Array.from({ length: this.pages }, (_, i) => i + 1); }

  get summary(): string { return `${this.filtered.length} đơn đặt chỗ · Sắp xếp theo ngày sử dụng`; }
  get sortLabel(): string { return this.newestFirst ? 'Mới nhất ↓' : 'Cũ nhất ↑'; }
  get footnote(): string {
    const suffix = this.status === 'all' ? '' : ` ${STATUS_LABEL[this.status as BookingStatus].toLowerCase()}`;
    return `Đã hiển thị ${this.rows.length} / ${this.filtered.length} đơn${suffix}`;
  }

  setStatus(key: StatusFilter): void { this.status = key; this.page = 1; }
  toggleSort(): void { this.newestFirst = !this.newestFirst; this.page = 1; }
  goTo(p: number): void { this.page = Math.min(Math.max(1, p), this.pages); }
  applyFilter(): void {
    // Nếu người dùng chọn ngược khoảng, hoán đổi để tránh danh sách trống khó hiểu.
    if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
      [this.fromDate, this.toDate] = [this.toDate, this.fromDate];
    }
    this.applied = { from: this.fromDate || '0000-00-00', to: this.toDate || '9999-12-31' };
    this.page = 1;
  }

  fmtDate(iso: string): string { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
  fmtMoney(n: number): string { return n.toLocaleString('vi-VN') + 'đ'; }
  eyeIcon(b: Booking): string {
    return b.status === 'completed' ? 'eye-view-fill' : b.status === 'cancelled' || b.status === 'noshow' ? 'eye-view-off' : 'eye-view';
  }
  logout(): void { console.log('Đăng xuất'); } // TODO: gọi AuthService.logout()
  trackById(_: number, b: Booking): string { return b.id; }
}
