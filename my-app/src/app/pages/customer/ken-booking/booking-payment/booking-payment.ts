import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth.service';
import { CustomerApiService } from '../../../../core/customer-api.service';
import { KenBookingState, kenMoney } from '../booking-state';

@Component({ selector: 'app-ken-booking-payment', standalone: false, templateUrl: './booking-payment.html', styleUrl: './booking-payment.css' })
export class KenBookingPaymentPage implements OnInit, OnDestroy {
  private readonly api = inject(CustomerApiService, { optional: true });
  now = Date.now();
  authorized = false;
  paying = false;
  payMessage = '';
  paymentOutcome: 'pending' | 'success' | 'failed' = 'pending';
  confirmedCode = '';
  paidAmount = 0;
  private timer?: ReturnType<typeof setInterval>;
  readonly money = kenMoney;
  constructor(public state: KenBookingState, private router: Router, private auth: AuthService) {}
  ngOnInit(): void {
    this.auth.ensureSession().subscribe({
      next: user => {
        if (!user) {
          this.router.navigate(['/login'], { queryParams: { returnUrl: '/booking/review' } });
          return;
        }
        this.authorized = true;
        if (this.state.draft().paymentStatus === 'CONFIRMED') {
          this.paymentOutcome = 'success';
          this.confirmedCode = this.state.draft().createdBookingCode || '';
        }
        this.timer = setInterval(() => this.now = Date.now(), 1000);
      },
      error: () => this.router.navigate(['/login'], { queryParams: { returnUrl: '/booking/review' } }),
    });
  }
  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }
  get remaining(): number { return Math.max(0, Math.ceil(((this.state.draft().holdUntil || 0) - this.now) / 1000)); }
  get countdown(): string { const r = this.remaining; return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`; }
  get demoExpired(): boolean { return this.remaining === 0 && this.paymentOutcome !== 'success'; }
  get paidConfirmed(): boolean { return this.paymentOutcome === 'success'; }
  back(): void { this.router.navigateByUrl('/booking/review'); }

  startNewBooking(): void {
    this.state.set({
      holdUntil: null,
      createdBookingId: null,
      createdBookingCode: null,
      paymentStatus: null,
      agreed: false,
    });
    this.router.navigateByUrl('/booking/spaces');
  }

  payNow(result: 'SUCCESS' | 'FAILED' = 'SUCCESS'): void {
    const id = this.state.draft().createdBookingId;
    if (!this.api || !id || this.paying) return;
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
