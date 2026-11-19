import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../../core/auth.service';
import { ApiBooking, CustomerApiService } from '../../../../core/customer-api.service';
import { KenBookingState, kenMoney } from '../booking-state';

function tryInjectCustomerApi(): CustomerApiService | null {
  try {
    return inject(CustomerApiService, { optional: true });
  } catch {
    return null;
  }
}

@Component({ selector: 'app-ken-booking-payment', standalone: false, templateUrl: './booking-payment.html', styleUrl: './booking-payment.css' })
export class KenBookingPaymentPage implements OnInit, OnDestroy {
  private readonly api = tryInjectCustomerApi();
  private readonly route = inject(ActivatedRoute, { optional: true });
  now = signal(Date.now());
  authorized = false;
  paying = false;
  payMessage = '';
  paymentOutcome: 'pending' | 'success' | 'failed' = 'pending';
  confirmedCode = '';
  paidAmount = 0;
  resumedAmount: number | null = null;
  private timer?: ReturnType<typeof setInterval>;
  readonly money = kenMoney;
  get tierDiscountLabel(): string { return this.state.tierDiscountLabel || 'Ưu đãi thành viên'; }
  get displayTotal(): number { return this.resumedAmount ?? this.state.total; }
  constructor(public state: KenBookingState, private router: Router, private auth: AuthService) {}
  ngOnInit(): void {
    this.auth.ensureSession().subscribe({
      next: user => {
        if (!user) {
          this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url || '/booking/review' } });
          return;
        }
        this.authorized = true;
        const d = this.state.draft();
        const patch: { fullName?: string; phone?: string; email?: string } = {};
        if (!d.fullName?.trim() && user?.fullName) patch.fullName = user.fullName;
        if (!d.phone?.trim() && user?.phone) patch.phone = user.phone;
        if (!d.email?.trim() && user?.email) patch.email = user.email;
        if (Object.keys(patch).length > 0) this.state.set(patch);

        const queryBookingId = this.route?.snapshot?.queryParamMap?.get('bookingId');
        const targetId = queryBookingId || d.createdBookingId;
        if (targetId && this.api) {
          this.syncBookingFromServer(targetId);
        } else if (this.state.draft().paymentStatus === 'CONFIRMED') {
          this.paymentOutcome = 'success';
          this.confirmedCode = this.state.draft().createdBookingCode || '';
        }
        this.timer = setInterval(() => this.now.set(Date.now()), 1000);
      },
      error: () => this.router.navigate(['/login'], { queryParams: { returnUrl: '/booking/review' } }),
    });
  }

  private syncBookingFromServer(bookingId: string): void {
    this.api?.getBookingDetail(bookingId).subscribe({
      next: (booking: ApiBooking) => {
        this.resumedAmount = booking.final_amount;
        this.state.syncQuoteFromBooking(booking);
        const expiresMs = booking.payment_expires_at ? new Date(booking.payment_expires_at).getTime() : 0;
        const isDone = booking.status === 'CONFIRMED' || booking.status === 'CHECKED_IN' || booking.status === 'CHECKED_OUT';
        const isClosed = booking.status === 'EXPIRED' || booking.status === 'CANCELLED';
        this.state.set({
          createdBookingId: booking._id,
          createdBookingCode: booking.booking_code,
          paymentStatus: booking.status,
          holdUntil: isClosed ? 0 : expiresMs,
        });
        if (isDone) {
          this.paymentOutcome = 'success';
          this.confirmedCode = booking.booking_code;
          this.paidAmount = booking.final_amount;
        } else {
          this.paymentOutcome = 'pending';
        }
      },
      error: () => {},
    });
  }
  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }
  get remaining(): number { return Math.max(0, Math.ceil(((this.state.draft().holdUntil || 0) - this.now()) / 1000)); }
  get countdown(): string { const r = this.remaining; return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`; }
  get isExpired(): boolean { return this.remaining === 0 && this.paymentOutcome !== 'success'; }
  get demoExpired(): boolean { return this.isExpired; }
  get paidConfirmed(): boolean { return this.paymentOutcome === 'success'; }
  back(): void { this.router.navigateByUrl('/booking/review'); }

  startNewBooking(): void {
    this.state.set({
      voucher: '',
      holdUntil: null,
      createdBookingId: null,
      createdBookingCode: null,
      paymentStatus: null,
      agreed: false,
    });
    this.state.clearAppliedVoucher();
    this.router.navigateByUrl('/spaces');
  }

  payNow(result: 'SUCCESS' | 'FAILED' = 'SUCCESS'): void {
    const id = this.state.draft().createdBookingId;
    if (!this.api || !id || this.paying || this.paymentOutcome === 'success') return;
    this.paying = true;
    this.payMessage = '';
    this.api.payBooking(id, result).subscribe({
      next: (res) => {
        this.paying = false;
        this.state.set({ paymentStatus: res.booking.status });
        if (res.booking.status === 'CONFIRMED') {
          this.paymentOutcome = 'success';
          this.confirmedCode = res.booking.booking_code;
          this.paidAmount = res.booking.final_amount;
          this.payMessage = `Thanh toán thành công! Mã đặt chỗ của bạn là #${res.booking.booking_code}.`;
        } else {
          this.paymentOutcome = 'failed';
          this.payMessage = 'Thanh toán chưa thành công. Đơn vẫn đang được giữ chỗ trong thời gian đếm ngược, bạn có thể thử thanh toán lại.';
        }
      },
      error: (err) => {
        this.paying = false;
        this.paymentOutcome = 'failed';
        this.payMessage = err?.error?.message || 'Không thể xác nhận thanh toán. Vui lòng thử lại.';
      },
    });
  }
}
