import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { KenBookingState, kenMoney } from '../../ken-booking/booking-state';

@Component({
  selector: 'app-focus-page',
  standalone: false,
  templateUrl: './focus-page.html',
  styleUrl: './focus-page.css',
})
export class FocusPage implements OnInit {
  private readonly router = inject(Router, { optional: true });
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly bookingState = inject(KenBookingState, { optional: true });
  info = '';
  backPath = '/spaces';

  ngOnInit(): void {
    this.bookingState?.syncCatalogFromApi(true);
    this.route?.queryParamMap?.subscribe(params => {
      this.backPath = '/spaces';
    });
  }

  get spaceData() {
    return this.bookingState?.getSpace('focus');
  }

  private ratePrice(hours: number, fallback: number): number {
    return this.spaceData?.rates.find(r => r.hours === hours)?.price ?? fallback;
  }

  get hourlyPriceText(): string {
    return kenMoney(this.ratePrice(1, 45000));
  }

  get halfDayPriceText(): string {
    return kenMoney(this.ratePrice(4, 140000));
  }

  showInfo(): void {
    this.router?.navigateByUrl('/booking/focus-pod');
  }
}
