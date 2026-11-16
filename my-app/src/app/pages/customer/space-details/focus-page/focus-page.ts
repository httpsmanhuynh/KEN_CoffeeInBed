import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { KenBookingState } from '../../ken-booking/booking-state';

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
    this.bookingState?.syncCatalogFromApi();
    this.route?.queryParamMap?.subscribe(params => {
      this.backPath = params.get('from') === 'booking' ? '/booking/spaces' : '/spaces';
    });
  }

  get spaceData() {
    return this.bookingState?.getSpace('focus');
  }

  showInfo(): void {
    this.router?.navigateByUrl('/booking/focus-pod');
  }
}
