import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { KenBookingState } from '../../ken-booking/booking-state';

@Component({
  selector: 'app-connect-page',
  standalone: false,
  templateUrl: './connect-page.html',
  styleUrl: './connect-page.css',
})
export class ConnectPage implements OnInit {
  private readonly router = inject(Router, { optional: true });
  private readonly bookingState = inject(KenBookingState, { optional: true });
  info = '';

  ngOnInit(): void {
    this.bookingState?.syncCatalogFromApi();
  }

  showInfo(): void {
    this.router?.navigateByUrl('/menu');
  }
}
