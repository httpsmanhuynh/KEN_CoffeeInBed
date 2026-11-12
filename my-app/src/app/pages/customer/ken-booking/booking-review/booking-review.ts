import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { AuthService } from '../../../../core/auth.service';
import { CustomerApiService } from '../../../../core/customer-api.service';
import { KenBookingState, kenMoney } from '../booking-state';
import type { KenBookingDraft } from '../booking-state';

const SPACE_CODE_MAP: Record<string, string> = {
  focus: 'FP-01',
  work: 'WL-01',
  'meeting-small': 'SMR-01',
  'meeting-large': 'BR-01',
  single: 'SBP-01',
  double: 'DBP-01',
  private: 'PS-01',
};

@Component({ selector: 'app-ken-booking-review', standalone: false, templateUrl: './booking-review.html', styleUrl: './booking-review.css' })
export class KenBookingReviewPage {
  private readonly api = inject(CustomerApiService, { optional: true });
  feedback = '';
  voucherMessage = '';
  checkingSession = false;
  submitting = false;
  readonly money = kenMoney;
  constructor(public state: KenBookingState, private router: Router, private auth: AuthService) {}
  setContact(key: 'fullName' | 'phone' | 'email' | 'note' | 'voucher', value: string): void {
    this.state.set({ [key]: value } as Pick<KenBookingDraft, typeof key>);
    this.feedback = '';
  }
  setAgreed(value: boolean): void { this.state.set({ agreed: value }); this.feedback = ''; }
  extraCount(id: string): number { return this.state.draft().extras[id] || 0; }
  drinkCharge(price: number, quantity: number): number {
    return Math.max(0, price - this.state.entitlement) * quantity;
  }

  private resolveRealTarget() {
    const d = this.state.draft();
    const startAt = new Date(`${d.date}T${String(d.startHour).padStart(2, '0')}:00:00+07:00`).toISOString();
    return this.api!.getSpaces({ startAt, hours: String(d.hours), guestCount: String(d.guests) }).pipe(
      map((spaces) => {
        const expectedCode = SPACE_CODE_MAP[d.spaceId];
        const sp = spaces.find((s) => s.space_code === expectedCode) || spaces[0];
        const pkgs: any[] = sp?.packages || [];
        const pkg =
          pkgs.find((p) => p.duration_hours === d.hours) ||
          pkgs.find((p) => p.package_type === 'HOURLY') ||
          pkgs.find((p) => p.is_full_day) ||
          pkgs[0];
        return { sp, pkg, startAt, d };
      }),
    );
  }

  checkVoucher(): void {
    const code = this.state.draft().voucher.trim();
    if (!code) { this.voucherMessage = 'Vui lòng nhập mã khuyến mãi.'; return; }
    if (!this.api) { this.voucherMessage = 'Mã khuyến mãi chưa kết nối hệ thống. Bản mô phỏng không áp dụng mã này.'; return; }
    this.voucherMessage = 'Đang kiểm tra mã…';
    this.resolveRealTarget().pipe(
      switchMap(({ sp, pkg, startAt, d }) => {
        if (!sp?._id || !pkg?._id) throw { error: { message: 'Không tìm thấy gói phù hợp trong hệ thống.' } };
        return this.api!.quoteBooking({
          spaceId: String(sp._id),
          packageId: String(pkg._id),
          startAt,
          hours: d.hours,
          guestCount: d.guests,
          voucherCode: code,
        });
      }),
    ).subscribe({
      next: (q) => {
        this.voucherMessage = `Áp dụng mã ${q.voucherCode} thành công: giảm ${this.money(q.pricing.voucherDiscount)} (tổng thanh toán: ${this.money(q.pricing.finalAmount)}).`;
      },
      error: (err) => {
        this.voucherMessage = err?.error?.message || 'Mã voucher không hợp lệ hoặc chưa đủ điều kiện áp dụng.';
      },
    });
  }
  confirm(): void {
    if (this.checkingSession) return;
    this.checkingSession = true;
    this.auth.ensureSession().subscribe({
      next: user => {
        this.checkingSession = false;
        if (!user) {
          this.router.navigate(['/login'], { queryParams: { returnUrl: '/booking/review' } });
          return;
        }
        const draft = this.state.draft();
        this.state.set({
          fullName: draft.fullName || user.fullName,
          phone: draft.phone || user.phone,
          email: draft.email || user.email || '',
        });
        this.confirmAuthenticated();
      },
      error: () => {
        this.checkingSession = false;
        this.router.navigate(['/login'], { queryParams: { returnUrl: '/booking/review' } });
      },
    });
  }

  private confirmAuthenticated(): void {
    const d = this.state.draft();
    if (!this.state.isSlotValid) {
      this.feedback = 'Khung giờ đã chọn chưa hợp lệ hoặc không còn cách hiện tại ít nhất 30 phút. Hãy quay lại chọn ngày giờ.';
    } else if (this.state.requiredDrinkCount > 0 &&
               this.state.selectedDrinkCount !== this.state.requiredDrinkCount) {
      this.feedback = `Vui lòng chọn đủ ${this.state.requiredDrinkCount} đồ uống trước khi xác nhận.`;
    } else if (!d.fullName.trim() || !/^((0|\+84)[0-9]{9,10})$/.test(d.phone.trim()) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) {
      this.feedback = 'Vui lòng nhập họ tên, số điện thoại và email hợp lệ.';
    } else if (!d.agreed) {
      this.feedback = 'Bạn cần đọc và đồng ý với Điều khoản & Chính sách trước khi tiếp tục.';
    } else {
      this.feedback = '';
      if (!this.api) {
        this.state.startDemoHold();
        this.router.navigateByUrl('/bookings/payment');
        return;
      }
      // Nếu đã có đơn PENDING_PAYMENT còn hạn cho đúng lựa chọn hiện tại (vừa quay lại để bổ sung thông tin liên hệ) -> đi thẳng sang thanh toán.
      if (d.createdBookingId && d.holdUntil && d.holdUntil > Date.now() && d.paymentStatus === 'PENDING_PAYMENT') {
        this.router.navigateByUrl('/bookings/payment');
        return;
      }
      if (this.submitting) return;
      this.submitting = true;
      this.resolveRealTarget().pipe(
        switchMap(({ sp, pkg, startAt }) => {
          if (!sp?._id || !pkg?._id) throw { error: { message: 'Không tìm thấy không gian hoặc gói phù hợp trên server.' } };
          return this.api!.createBooking({
            spaceId: String(sp._id),
            packageId: String(pkg._id),
            startAt,
            hours: d.hours,
            guestCount: d.guests,
            voucherCode: d.voucher.trim() || undefined,
          });
        }),
      ).subscribe({
        next: (booking) => {
          this.submitting = false;
          this.state.set({
            holdUntil: booking.payment_expires_at ? new Date(booking.payment_expires_at).getTime() : Date.now() + 15 * 60000,
            createdBookingId: booking._id,
            createdBookingCode: booking.booking_code,
            paymentStatus: booking.status,
          });
          this.router.navigateByUrl('/bookings/payment');
        },
        error: (err) => {
          this.submitting = false;
          this.feedback = err?.error?.message || 'Không thể tạo đơn đặt chỗ. Vui lòng kiểm tra lại khung giờ.';
        },
      });
    }
  }

  get selectedExtras() {
    return this.state.extras.filter(extra => this.extraCount(extra.id) > 0);
  }
}
