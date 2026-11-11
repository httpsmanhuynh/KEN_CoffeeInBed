import { KenBookingPaymentPage } from './booking-payment';
import { TestBed } from '@angular/core/testing';
import { AppModule } from '../../../../app-module';
import { KenBookingState } from '../booking-state';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth.service';
import { of } from 'rxjs';
import { vi } from 'vitest';

describe('KenBookingPaymentPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AppModule] }).compileComponents();
  });

  it('exports the Angular component', () => {
    expect(KenBookingPaymentPage).toBeDefined();
  });

  it('redirects guests away from payment', () => {
    const navigate = vi.fn();
    const router = { navigate } as unknown as Router;
    const auth = { ensureSession: () => of(null) } as unknown as AuthService;
    const page = new KenBookingPaymentPage(new KenBookingState(), router, auth);

    page.ngOnInit();

    expect(page.authorized).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/booking/review' },
    });
    page.ngOnDestroy();
  });
});