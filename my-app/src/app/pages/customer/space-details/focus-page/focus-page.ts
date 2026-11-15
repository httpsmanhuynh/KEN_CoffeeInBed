import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { KenBookingState } from '../../ken-booking/booking-state';

@Component({
  selector: 'app-focus-page',
  standalone: false,
  templateUrl: './focus-page.html',
  styleUrl: './focus-page.css',
})
export class FocusPage implements OnInit {
  private readonly router = inject(Router, { optional: true });
  private readonly bookingState = inject(KenBookingState, { optional: true });
  info = '';

  ngOnInit(): void {
    this.bookingState?.syncCatalogFromApi();
  }

  get spaceData() {
    return this.bookingState?.getSpace('focus');
  }

  showInfo(): void {
    this.router?.navigateByUrl('/booking/focus-pod');
  }
}
