import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

type CancelStatus = 'confirmed' | 'pending';
interface CancelOrder {
  code: string; name: string; status: CancelStatus;
  date: string; time: string; hours: number; pkg: string; total: number;
}

@Component({
  selector: 'app-booking-cancel',
  standalone: false,
  styleUrl: './booking-cancel.css',
  templateUrl: './booking-cancel.html',
})
export class BookingCancel {
  private readonly route = inject(ActivatedRoute);

  // TODO: thay bằng API. Dữ liệu minh hoạ; đơn mặc định khớp Figma.
  readonly orders: CancelOrder[] = [
    { code: '#KEN-241026-006', name: 'Ô tập trung cá nhân (Focus Pod)', status: 'confirmed', date: '24/10/2026', time: '09:00–13:00', hours: 4, pkg: 'Nửa ngày', total: 140000 },
    { code: '#KEN-261026-009', name: 'KÉN nghỉ đơn', status: 'pending', date: '26/10/2026', time: '13:00–15:00', hours: 2, pkg: '2h', total: 90000 },
    { code: '#KEN-251026-024', name: 'Phòng họp nhỏ', status: 'pending', date: '25/10/2026', time: '14:00–17:00', hours: 3, pkg: 'Họp nhóm nhỏ', total: 480000 },
  ];
  readonly statusLabel: Record<CancelStatus, string> = { confirmed: 'Đã xác nhận', pending: 'Chờ xác nhận' };

  /** Chọn đơn qua ?code=KEN-xxxx (ví dụ từ trang Lịch sử đặt chỗ); mặc định đơn đầu tiên. */
  readonly order: CancelOrder = this.pick(this.route.snapshot.queryParamMap.get('code'));
  submitted = false;

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
    this.submitted = true; // TODO: gọi API gửi yêu cầu huỷ
  }

  fmtMoney(n: number): string { return n.toLocaleString('vi-VN') + 'đ'; }
  logout(): void { console.log('Đăng xuất'); } // TODO: AuthService.logout()
}
