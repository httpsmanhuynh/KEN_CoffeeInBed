import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { KenBookingState, kenMoney } from '../../ken-booking/booking-state';

@Component({
  selector: 'app-cowork-page',
  standalone: false,
  templateUrl: './cowork-page.html',
  styleUrl: './cowork-page.css',
})
export class CoworkPage implements OnInit {
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
    return this.bookingState?.getSpace('work');
  }

  private ratePrice(hours: number, fallback: number): number {
    return this.spaceData?.rates.find(r => r.hours === hours)?.price ?? fallback;
  }

  get flexPriceText(): string {
    return kenMoney(this.ratePrice(1, 30000));
  }

  get halfDayPriceText(): string {
    return kenMoney(this.ratePrice(4, 90000));
  }

  get fullDayPriceText(): string {
    return kenMoney(this.ratePrice(14, 150000));
  }

  showInfo(): void {
    this.router?.navigateByUrl('/booking/work');
  }
}
