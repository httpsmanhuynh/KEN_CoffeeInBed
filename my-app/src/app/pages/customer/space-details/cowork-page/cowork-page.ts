import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { KenBookingState } from '../../ken-booking/booking-state';

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
    this.bookingState?.syncCatalogFromApi();
    this.route?.queryParamMap?.subscribe(params => {
      this.backPath = '/spaces';
    });
  }

  get spaceData() {
    return this.bookingState?.getSpace('work');
  }

  showInfo(): void {
    this.router?.navigateByUrl('/booking/work');
  }
}
