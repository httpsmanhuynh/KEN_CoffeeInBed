import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/auth.service';
import { CustomerApiService } from '../../../../core/customer-api.service';

type CancelStatus = 'confirmed' | 'pending';
interface CancelOrder {
  rawId?: string;
  code: string; name: string; status: CancelStatus;
  date: string; time: string; hours: number; pkg: string; total: number;
}

@Component({
  selector: 'app-booking-cancel',
  standalone: false,
  styleUrl: './booking-cancel.css',
  templateUrl: './booking-cancel.html',
})
export class BookingCancel implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService, { optional: true });
  private readonly api = inject(CustomerApiService, { optional: true });
  private readonly router = inject(Router, { optional: true });

  orders: CancelOrder[] = [
    { code: '#KEN-241026-006', name: 'Ô tập trung cá nhân (Focus Pod)', status: 'confirmed', date: '24/10/2026', time: '09:00–13:00', hours: 4, pkg: 'Nửa ngày', total: 140000 },
    { code: '#KEN-261026-009', name: 'KÉN nghỉ đơn', status: 'pending', date: '26/10/2026', time: '13:00–15:00', hours: 2, pkg: '2h', total: 90000 },
    { code: '#KEN-251026-024', name: 'Phòng họp nhỏ', status: 'pending', date: '25/10/2026', time: '14:00–17:00', hours: 3, pkg: 'Họp nhóm nhỏ', total: 480000 },
  ];
  readonly statusLabel: Record<CancelStatus, string> = { confirmed: 'Đã xác nhận', pending: 'Chờ xác nhận' };

  /** Chọn đơn qua ?code=KEN-xxxx (ví dụ từ trang Lịch sử đặt chỗ); mặc định đơn đầu tiên. */
  order: CancelOrder = this.pick(this.route.snapshot.queryParamMap.get('code'));
  submitted = false;
  cancelError = '';

  ngOnInit(): void {
    if (!this.api || !this.auth) return;
    this.auth.ensureSession().subscribe({
      next: (user) => {
        if (!user) return;
        forkJoin({
          bookings: this.api!.getMyBookings(),
          spaces: this.api!.getSpaces(),
        }).subscribe({
          next: ({ bookings, spaces }) => {
            const spaceMap = new Map<string, any>(spaces.map((s) => [String(s._id), s]));
            const cancellable = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'PENDING_PAYMENT');
            if (!cancellable.length) return;
            this.orders = cancellable.map((b) => {
              const sVn = new Date(new Date(b.start_at).getTime() + 7 * 3600000);
              const eVn = new Date(new Date(b.end_at).getTime() + 7 * 3600000);
              const hrs = Math.max(1, Math.round((eVn.getTime() - sVn.getTime()) / 3600000));
              const [y, m, d] = sVn.toISOString().slice(0, 10).split('-');
              return {
                rawId: b._id,
                code: `#${b.booking_code}`,
                name: spaceMap.get(String(b.space_id))?.name || 'Không gian KÉN',
                status: b.status === 'CONFIRMED' ? 'confirmed' : 'pending',
                date: `${d}/${m}/${y}`,
                time: `${sVn.toISOString().slice(11, 16)}–${eVn.toISOString().slice(11, 16)}`,
                hours: hrs,
                pkg: `${hrs} giờ`,
                total: b.final_amount,
              };
            });
            this.order = this.pick(this.route.snapshot.queryParamMap.get('code'));
          },
        });
      },
    });
  }

  private pick(code: string | null): CancelOrder {
    const c = (code ?? '').replace('#', '');
    return this.orders.find(o => o.code.replace('#', '') === c) ?? this.orders[0];
  }

  get isConfirmed(): boolean { return this.order.status === 'confirmed'; }
  get conditionLine(): string {
    return this.isConfirmed ? 'Đã xác nhận · áp dụng hạn huỷ' : 'Đơn chưa được xác nhận';
  }
  get conditionNote(): string {
    return this.isConfirmed
      ? 'KÉN sẽ kiểm tra điều kiện huỷ sau khi nhận yêu cầu.'
      : 'KÉN sẽ kiểm tra yêu cầu sau khi nhận.';
  }
  get paidText(): string { return this.isConfirmed ? this.fmtMoney(this.order.total) : 'Chờ đối chiếu'; }

  confirmCancel(): void {
    if (this.submitted) return;
    if (this.api && this.order.rawId) {
      this.cancelError = '';
      this.api.cancelBooking(this.order.rawId).subscribe({
        next: () => { this.submitted = true; },
        error: (err) => { this.cancelError = err.error?.message || 'Không thể huỷ đơn lúc này.'; },
      });
      return;
    }
    this.submitted = true;
  }

  fmtMoney(n: number): string { return n.toLocaleString('vi-VN') + 'đ'; }
  logout(): void {
    if (!this.auth) return;
    this.auth.logout().subscribe({ next: () => this.router?.navigateByUrl('/') });
  }
}
