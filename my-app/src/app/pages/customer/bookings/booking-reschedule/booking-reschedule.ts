import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/auth.service';
import { CustomerApiService } from '../../../../core/customer-api.service';

type OrderStatus = 'confirmed' | 'pending';
interface Order {
  id: string; code: string; name: string; zone: string; status: OrderStatus;
  spaceId?: string;
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
export class BookingReschedule implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService, { optional: true });
  private readonly api = inject(CustomerApiService, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly cdr = inject(ChangeDetectorRef, { optional: true });
  orders: Order[] = [
    { id: 'o1', code: '#KEN-241026-006', name: 'Ô tập trung cá nhân (Focus Pod)', zone: 'Focus Pod', status: 'confirmed', date: '2026-10-24', start: '09:00', hours: 4, guests: 1, total: 140000 },
    { id: 'o2', code: '#KEN-261026-009', name: 'KÉN nghỉ đơn', zone: 'KÉN Nghỉ Ngơi', status: 'pending', date: '2026-10-26', start: '13:00', hours: 2, guests: 1, total: 90000 },
    { id: 'o3', code: '#KEN-251026-024', name: 'Phòng họp nhỏ', zone: 'KÉN Tập Trung', status: 'pending', date: '2026-10-25', start: '14:00', hours: 3, guests: 4, total: 480000 },
  ];
  readonly statusLabel: Record<OrderStatus, string> = { confirmed: 'Đã xác nhận', pending: 'Chờ xác nhận' };
  get slots(): string[] {
    const out: string[] = [];
    const endLimit = this.hours >= 14 ? 20 : 22 - (this.hours || 1);
    const maxStart = Math.max(8, Math.min(21, endLimit));
    for (let h = 8; h <= maxStart; h++) {
      out.push(`${pad(h)}:00`);
    }
    return out.length ? out : ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
  }
  readonly durations = [2, 3, 4, 5, 6];

  selectedId = 'o1';
  newDate = '2026-10-25';
  hours = 4;
  start = '09:00';
  note = 'Mình muốn dời sang Chủ nhật, giữ nguyên gói 4 giờ và 01 khách.';
  acknowledged = false;
  rechecking = false;
  submitted = false;
  rescheduleError = '';
  liveFull = false;
  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    if (!this.api || !this.auth) return;
    this.auth.ensureSession().subscribe({
      next: (user) => {
        if (!user) return;
        forkJoin({
          bookings: this.api!.getMyBookings('CONFIRMED'),
          spaces: this.api!.getSpaces(),
        }).subscribe({
          next: ({ bookings, spaces }) => {
            if (!bookings.length) {
              this.orders = [];
              this.cdr?.markForCheck();
              return;
            }
            const spaceMap = new Map<string, any>(spaces.map((s) => [String(s._id), s]));
            this.orders = bookings.map((b) => {
              const sVn = new Date(new Date(b.start_at).getTime() + 7 * 3600000);
              const eVn = new Date(new Date(b.end_at).getTime() + 7 * 3600000);
              const hrs = Math.max(1, Math.round((eVn.getTime() - sVn.getTime()) / 3600000));
              const sp = spaceMap.get(String(b.space_id));
              return {
                id: b._id,
                spaceId: String(b.space_id),
                code: `#${b.booking_code}`,
                name: sp?.name || 'Không gian KÉN',
                zone: sp?.space_code || 'KÉN',
                status: 'confirmed',
                date: sVn.toISOString().slice(0, 10),
                start: sVn.toISOString().slice(11, 16),
                hours: hrs,
                guests: b.guest_count,
                total: b.final_amount,
              };
            });
            this.selectedId = this.orders[0].id;
            const d = new Date(this.orders[0].date + 'T00:00:00');
            d.setDate(d.getDate() + 1);
            this.newDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            this.hours = this.orders[0].hours;
            this.start = this.slots.includes(this.orders[0].start) ? this.orders[0].start : '09:00';
            this.checkLiveAvailability();
            this.cdr?.markForCheck();
          },
        });
      },
    });
  }

  get order(): Order { return this.orders.find(o => o.id === this.selectedId) ?? this.orders[0]; }
  get end(): string { return `${pad(parseInt(this.start, 10) + this.hours)}:00`; }
  get orderEnd(): string { return this.order ? this.endOf(this.order) : '—'; }
  endOf(o: Order): string { return `${pad(parseInt(o.start, 10) + o.hours)}:00`; }
  shortName(o: Order): string { return o.name.replace(/\s*\(.*\)$/, ''); }
  guests(o: Order): string { return pad(o.guests); }

  /** 'ok' = còn chỗ, 'full' = hết chỗ, 'same' = trùng lịch hiện tại, 'none' = chưa chọn ngày. */
  get availability(): 'ok' | 'full' | 'same' | 'none' {
    if (!this.newDate || !this.order) return 'none';
    const o = this.order;
    if (this.newDate === o.date && this.start === o.start && this.hours === o.hours) return 'same';
    return this.liveFull ? 'full' : 'ok';
  }
  get canSubmit(): boolean { return this.availability === 'ok' && !this.submitted && !this.rechecking; }

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
    this.checkLiveAvailability();
  }

  pickSlot(s: string): void { this.start = s; this.submitted = false; this.checkLiveAvailability(); }
  touch(): void { this.submitted = false; this.checkLiveAvailability(); }

  private checkLiveAvailability(): void {
    this.liveFull = false;
    this.rescheduleError = '';
    if (!this.api || !this.newDate || !this.order?.spaceId) return;
    const startAt = new Date(`${this.newDate}T${this.start}:00+07:00`);
    if (!Number.isFinite(startAt.getTime())) return;
    this.rechecking = true;
    this.api.getSpaces({
      startAt: startAt.toISOString(),
      hours: String(this.hours),
      guestCount: String(this.order.guests),
    }).subscribe({
      next: (spaces) => {
        this.rechecking = false;
        const sp = spaces.find((x) => String(x._id) === this.order.spaceId);
        this.liveFull = sp ? !sp.isAvailable : false;
        this.cdr?.markForCheck();
      },
      error: () => {
        this.rechecking = false;
        this.cdr?.markForCheck();
      },
    });
  }

  confirm(): void {
    if (!this.canSubmit) return;
    if (this.api && this.auth?.user && /^[0-9a-f]{24}$/i.test(this.selectedId)) {
      this.rescheduleError = '';
      const newStartAt = new Date(`${this.newDate}T${this.start}:00+07:00`).toISOString();
      this.api.rescheduleBooking(this.selectedId, newStartAt).subscribe({
        next: () => { this.submitted = true; },
        error: (err) => { this.rescheduleError = err.error?.message || 'Không thể đổi lịch lúc này.'; },
      });
      return;
    }
    this.submitted = true;
  }

  fmtDate(iso: string): string { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
  fmtMoney(n: number): string { return n.toLocaleString('vi-VN') + 'đ'; }
  logout(): void {
    if (!this.auth) return;
    this.auth.logout().subscribe({ next: () => this.router?.navigateByUrl('/') });
  }
  ngOnDestroy(): void { clearTimeout(this.timer); }
}
