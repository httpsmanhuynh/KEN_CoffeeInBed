import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { KenBookingState, kenMoney } from '../booking-state';

@Component({ selector: 'app-ken-booking-payment', standalone: false, templateUrl: './booking-payment.html', styleUrl: './booking-payment.css' })
export class KenBookingPaymentPage implements OnInit, OnDestroy {
  now = Date.now();
  private timer?: ReturnType<typeof setInterval>;
  readonly money = kenMoney;
  constructor(public state: KenBookingState, private router: Router) {}
  ngOnInit(): void { this.timer = setInterval(() => this.now = Date.now(), 1000); }
  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }
  get remaining(): number { return Math.max(0, Math.ceil(((this.state.draft().holdUntil || 0) - this.now) / 1000)); }
  get countdown(): string { const r = this.remaining; return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`; }
  get demoExpired(): boolean { return this.remaining === 0; }
  back(): void { this.router.navigateByUrl('/booking/review'); }
}
