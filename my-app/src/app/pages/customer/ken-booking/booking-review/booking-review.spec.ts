import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KenBookingReviewPage } from './booking-review';
import { TestBed } from '@angular/core/testing';
import { AppModule } from '../../../../app-module';
import { Router } from '@angular/router';
import { AuthService, AuthenticatedUser } from '../../../../core/auth.service';
import { KenBookingState, kenNextDay } from '../booking-state';
import { of, throwError } from 'rxjs';

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

  it('filters usable vouchers and pushes the best-value voucher to the top', () => {
    const state = new KenBookingState();
    const router = {} as unknown as Router;
    const auth = { ensureSession: () => of(null) } as unknown as AuthService;
    const page = new KenBookingReviewPage(state, router, auth);
    // Stub subtotal = 70,000đ
    Object.defineProperty(state, 'subtotal', { get: () => 70000 });

    page.userVoucherList = [
      { code: 'KEN30K', desc: 'Giảm 30.000đ', used: false, discountType: 'FIXED_AMOUNT', discountValue: 30000, minOrderValue: 0, maxDiscount: null },
      { code: 'KEN7PCT', desc: 'Giảm 7%', used: false, discountType: 'PERCENT', discountValue: 7, minOrderValue: 0, maxDiscount: null },
      { code: 'KEN50K', desc: 'Giảm 50.000đ', used: false, discountType: 'FIXED_AMOUNT', discountValue: 50000, minOrderValue: 0, maxDiscount: null },
      { code: 'FREE100', desc: 'Giảm 100%', used: false, discountType: 'PERCENT', discountValue: 100, minOrderValue: 0, maxDiscount: null },
      { code: 'WELCOME10', desc: 'Giảm 10% · Đơn từ 100.000đ', used: false, discountType: 'PERCENT', discountValue: 10, minOrderValue: 100000, maxDiscount: null },
      { code: 'USED50K', desc: 'Giảm 50.000đ', used: true, discountType: 'FIXED_AMOUNT', discountValue: 50000, minOrderValue: 0, maxDiscount: null },
    ];

    const usable = page.usableVoucherList;
    expect(usable.map((v) => v.code)).toEqual(['FREE100', 'KEN50K', 'KEN30K', 'KEN7PCT']);
    expect(usable[0].isBest).toBe(true);
    expect(usable[0].estimatedDiscount).toBe(70000);
    expect(usable[1].isBest).toBe(false);
    expect(usable[1].estimatedDiscount).toBe(50000);

    expect(page.voucherDropdownOpen).toBe(false);
    page.toggleVoucherDropdown();
    expect(page.voucherDropdownOpen).toBe(true);
  });
});