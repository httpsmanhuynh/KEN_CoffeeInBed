import { KenBookingReviewPage } from './booking-review';
import { TestBed } from '@angular/core/testing';
import { AppModule } from '../../../../app-module';
import { Router } from '@angular/router';
import { AuthService, AuthenticatedUser } from '../../../../core/auth.service';
import { KenBookingState, kenNextDay } from '../booking-state';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

describe('KenBookingReviewPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AppModule] }).compileComponents();
  });

  it('exports the Angular component', () => {
    expect(KenBookingReviewPage).toBeDefined();
  });

  it('redirects a guest to login instead of starting a booking hold', () => {
    const state = new KenBookingState();
    state.set({
      date: kenNextDay(),
      fullName: 'Nguyễn Thị KÉN',
      phone: '0900000000',
      email: 'ken@example.com',
      agreed: true,
    });
    const navigate = vi.fn();
    const router = { navigate } as unknown as Router;
    const auth = { ensureSession: () => of(null) } as unknown as AuthService;
    const page = new KenBookingReviewPage(state, router, auth);

    page.confirm();

    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/booking/review' },
    });
    expect(state.draft().holdUntil).toBeNull();
  });

  it('fails closed and redirects to login if the session cannot be checked', () => {
    const state = new KenBookingState();
    const navigate = vi.fn();
    const router = { navigate } as unknown as Router;
    const auth = {
      ensureSession: () => throwError(() => new Error('API unavailable')),
    } as unknown as AuthService;
    const page = new KenBookingReviewPage(state, router, auth);

    page.confirm();

    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/booking/review' },
    });
    expect(state.draft().holdUntil).toBeNull();
  });

  it('allows an authenticated customer who accepted terms to continue to payment', () => {
    const user: AuthenticatedUser = {
      id: 'customer-1',
      fullName: 'Nguyễn Thị KÉN',
      phone: '0900000000',
      email: 'ken@example.com',
      role: 'CUSTOMER',
      twoFactorEnabled: false,
      membershipTier: 'SILVER',
      tierPoints: 0,
      coinsBalance: 0,
    };
    const state = new KenBookingState();
    state.set({ date: kenNextDay(), agreed: true });
    const navigateByUrl = vi.fn();
    const router = { navigateByUrl } as unknown as Router;
    const auth = { ensureSession: () => of(user) } as unknown as AuthService;
    const page = new KenBookingReviewPage(state, router, auth);

    page.confirm();

    expect(navigateByUrl).toHaveBeenCalledWith('/bookings/payment');
    expect(state.draft().fullName).toBe(user.fullName);
    expect(state.draft().holdUntil).not.toBeNull();
  });
});