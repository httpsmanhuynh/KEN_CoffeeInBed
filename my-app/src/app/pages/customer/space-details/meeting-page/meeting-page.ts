import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { KenBookingState } from '../../ken-booking/booking-state';

@Component({
  selector: 'app-meeting-page',
  standalone: false,
  templateUrl: './meeting-page.html',
  styleUrl: './meeting-page.css',
})
export class MeetingPage implements OnInit {
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
    return this.bookingState?.getSpace('meeting-small');
  }

  showInfo(): void {
    this.router?.navigateByUrl('/booking/meeting-small');
  }
}
