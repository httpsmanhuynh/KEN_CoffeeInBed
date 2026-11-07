import { Component, OnDestroy } from '@angular/core';

type OrderStatus = 'confirmed' | 'pending';
interface Order {
  id: string; code: string; name: string; zone: string; status: OrderStatus;
  date: string;               // yyyy-mm-dd
  start: string;              // HH:00
  hours: number; guests: number; total: number;
}

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const pad = (n: number) => String(n).padStart(2, '0');

@Component({
  selector: 'app-booking-reschedule',
  standalone: false,
  styleUrl: './booking-reschedule.css',
  templateUrl: './booking-reschedule.html',
})
export class BookingReschedule implements OnDestroy {
  // TODO: thay bằng API (chỉ đơn tương lai có thể gửi yêu cầu). Dữ liệu minh hoạ theo Figma.
  readonly orders: Order[] = [
    { id: 'o1', code: '#KEN-241026-006', name: 'Ô tập trung cá nhân (Focus Pod)', zone: 'Focus Pod', status: 'confirmed', date: '2026-10-24', start: '09:00', hours: 4, guests: 1, total: 140000 },
    { id: 'o2', code: '#KEN-261026-009', name: 'KÉN nghỉ đơn', zone: 'KÉN Nghỉ Ngơi', status: 'pending', date: '2026-10-26', start: '13:00', hours: 2, guests: 1, total: 90000 },
    { id: 'o3', code: '#KEN-251026-024', name: 'Phòng họp nhỏ', zone: 'KÉN Tập Trung', status: 'pending', date: '2026-10-25', start: '14:00', hours: 3, guests: 4, total: 480000 },
  ];
  readonly statusLabel: Record<OrderStatus, string> = { confirmed: 'Đã xác nhận', pending: 'Chờ xác nhận' };
  readonly slots = ['08:00', '09:00', '14:00'];
  readonly durations = [2, 3, 4, 5, 6];

  selectedId = 'o1';
  newDate = '2026-10-25';
  hours = 4;
  start = '09:00';
  note = 'Mình muốn dời sang Chủ nhật, giữ nguyên gói 4 giờ và 01 khách.';
  acknowledged = false;
  rechecking = false;
  submitted = false;
  private timer?: ReturnType<typeof setTimeout>;

  get order(): Order { return this.orders.find(o => o.id === this.selectedId)!; }
  get end(): string { return `${pad(parseInt(this.start, 10) + this.hours)}:00`; }
  get orderEnd(): string { return this.endOf(this.order); }
  endOf(o: Order): string { return `${pad(parseInt(o.start, 10) + o.hours)}:00`; }
  shortName(o: Order): string { return o.name.replace(/\s*\(.*\)$/, ''); }
  guests(o: Order): string { return pad(o.guests); }

  /** 'ok' = còn chỗ, 'same' = trùng lịch hiện tại, 'none' = chưa chọn ngày. */
  get availability(): 'ok' | 'same' | 'none' {
    if (!this.newDate) return 'none';
    const o = this.order;
    return this.newDate === o.date && this.start === o.start && this.hours === o.hours ? 'same' : 'ok';
  }
  get canSubmit(): boolean { return this.availability === 'ok' && this.acknowledged && !this.submitted; }

  get proposedTitle(): string {
    if (!this.newDate) return 'Chưa chọn ngày';
    const d = new Date(this.newDate + 'T00:00:00');
    return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  }

  select(id: string): void {
    if (id === this.selectedId) return;
    this.selectedId = id;
    const o = this.order;
    const d = new Date(o.date + 'T00:00:00'); d.setDate(d.getDate() + 1);
    this.newDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    this.hours = o.hours; this.start = '09:00';
    this.acknowledged = false; this.submitted = false;
  }

  pickSlot(s: string): void { this.start = s; this.submitted = false; }
  touch(): void { this.submitted = false; }

  recheck(): void {
    this.rechecking = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => (this.rechecking = false), 600); // TODO: gọi API kiểm tra lịch trống
  }

  confirm(): void {
    if (!this.canSubmit) return;
    this.submitted = true; // TODO: gọi API gửi yêu cầu đổi lịch
  }

  fmtDate(iso: string): string { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
  fmtMoney(n: number): string { return n.toLocaleString('vi-VN') + 'đ'; }
  logout(): void { console.log('Đăng xuất'); } // TODO: AuthService.logout()
  ngOnDestroy(): void { clearTimeout(this.timer); }
}
