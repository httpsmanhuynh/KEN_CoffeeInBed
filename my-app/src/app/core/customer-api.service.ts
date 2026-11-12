import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthenticatedUser } from './auth.service';

export interface ApiVoucher {
  _id: string;
  code: string;
  description?: string | null;
  discount_type: 'PERCENT' | 'FIXED_AMOUNT';
  discount_value: number;
  min_order_value?: number;
  max_discount?: number | null;
  coins_cost?: number;
  status: string;
  valid_from?: string;
  valid_to?: string;
}

export interface ApiBooking {
  _id: string;
  booking_code: string;
  space_id: string;
  package_id: string;
  start_at: string;
  end_at: string;
  blocked_until?: string;
  guest_count: number;
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'EXPIRED' | 'NO_SHOW';
  payment_expires_at?: string;
  final_amount: number;
  subtotal?: number;
  package_price?: number;
  inclusion_surcharge?: number;
  addon_total?: number;
  voucher_discount?: number;
  tier_discount?: number;
  created_at?: string;
  has_review?: boolean;
  can_review?: boolean;
  review_reminder?: boolean;
  review?: { _id: string; rating: number; comment?: string | null; created_at?: string } | null;
}

export interface ApiBookingQuote {
  spaceId: string;
  spaceName: string;
  packageId: string;
  packageName: string;
  startAt: string;
  endAt: string;
  durationHours: number;
  guestCount: number;
  voucherCode: string | null;
  tierCode: string;
  tierRate: number;
  pricing: {
    packagePrice: number;
    inclusionSurcharge: number;
    addonTotal: number;
    subtotal: number;
    voucherDiscount: number;
    tierDiscount: number;
    finalAmount: number;
  };
}

export interface ApiLoyaltyHistory {
  transactions: Array<{
    _id: string;
    type: 'EARN' | 'REDEEM' | 'YEAR_RESET';
    points_delta: number;
    coins_delta: number;
    points_after: number;
    coins_after: number;
    note?: string;
    created_at: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class CustomerApiService {
  constructor(private http: HttpClient) {}

  // ─── Profile ───
  updateProfile(body: { fullName?: string; email?: string; currentPassword?: string }): Observable<AuthenticatedUser> {
    return this.http.patch<AuthenticatedUser>('/api/profile/me', body, { withCredentials: true });
  }

  sendProfileOtp(body: { purpose: 'CHANGE_PASSWORD' | 'CHANGE_PHONE' | 'TOGGLE_2FA'; newPhone?: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/api/profile/me/otp', body, { withCredentials: true });
  }

  changePassword(body: { currentPassword: string; newPassword: string; confirmPassword: string; code: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/api/profile/me/password', body, { withCredentials: true });
  }

  toggle2FA(body: { enabled: boolean; currentPassword: string; code: string }): Observable<{ twoFactorEnabled: boolean }> {
    return this.http.post<{ twoFactorEnabled: boolean }>('/api/profile/me/2fa', body, { withCredentials: true });
  }

  // ─── Catalog ───
  getSpaces(query?: Record<string, string>): Observable<any[]> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(query || {})) {
      if (v) params = params.set(k, v);
    }
    return this.http.get<any[]>('/api/spaces', { params, withCredentials: true });
  }

  getSpaceDetail(id: string): Observable<any> {
    return this.http.get<any>(`/api/spaces/${encodeURIComponent(id)}`, { withCredentials: true });
  }

  getProducts(): Observable<any[]> {
    return this.http.get<any[]>('/api/products', { withCredentials: true });
  }

  getAddons(): Observable<any[]> {
    return this.http.get<any[]>('/api/addons', { withCredentials: true });
  }

  getVouchers(): Observable<ApiVoucher[]> {
    return this.http.get<ApiVoucher[]>('/api/vouchers', { withCredentials: true });
  }

  // ─── Bookings ───
  selectPackage(body: {
    spaceId: string;
    packageId: string;
    startAt: string;
    hours?: number;
    guestCount: number;
  }): Observable<any> {
    return this.http.post('/api/bookings/select-package', body, { withCredentials: true });
  }

  quoteBooking(body: {
    spaceId: string;
    packageId: string;
    startAt: string;
    hours?: number;
    guestCount: number;
    inclusions?: Array<{ packageInclusionId: string; productId: string; variant?: string; quantity: number }>;
    addons?: Array<{ addonId: string; variant?: string; quantity: number }>;
    voucherCode?: string;
  }): Observable<ApiBookingQuote> {
    return this.http.post<ApiBookingQuote>('/api/bookings/quote', body, { withCredentials: true });
  }

  createBooking(body: {
    spaceId: string;
    packageId: string;
    startAt: string;
    hours?: number;
    guestCount: number;
    inclusions?: Array<{ packageInclusionId: string; productId: string; variant?: string; quantity: number }>;
    addons?: Array<{ addonId: string; variant?: string; quantity: number }>;
    voucherCode?: string;
    expectedFinalAmount?: number;
  }): Observable<ApiBooking> {
    return this.http.post<ApiBooking>('/api/bookings', body, { withCredentials: true });
  }

  payBooking(id: string, result: 'SUCCESS' | 'FAILED' = 'SUCCESS'): Observable<{ booking: ApiBooking; transaction: any; confirmation?: any }> {
    return this.http.post<{ booking: ApiBooking; transaction: any; confirmation?: any }>(
      `/api/bookings/${encodeURIComponent(id)}/pay`,
      { result },
      { withCredentials: true },
    );
  }

  getMyBookings(status?: string): Observable<ApiBooking[]> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<ApiBooking[]>('/api/bookings/me', { params, withCredentials: true });
  }

  getBookingDetail(id: string): Observable<ApiBooking> {
    return this.http.get<ApiBooking>(`/api/bookings/${encodeURIComponent(id)}`, { withCredentials: true });
  }

  cancelBooking(id: string): Observable<{ booking: ApiBooking }> {
    return this.http.post<{ booking: ApiBooking }>(`/api/bookings/${encodeURIComponent(id)}/cancel`, {}, { withCredentials: true });
  }

  rescheduleBooking(id: string, newStartAt: string): Observable<ApiBooking> {
    return this.http.post<ApiBooking>(
      `/api/bookings/${encodeURIComponent(id)}/reschedule`,
      { newStartAt },
      { withCredentials: true },
    );
  }

  // ─── Loyalty ───
  getTiers(): Observable<any[]> {
    return this.http.get<any[]>('/api/loyalty/tiers', { withCredentials: true });
  }

  getLoyaltyHistory(): Observable<ApiLoyaltyHistory> {
    return this.http.get<ApiLoyaltyHistory>('/api/loyalty/history', { withCredentials: true });
  }

  getMyVouchers(): Observable<any[]> {
    return this.http.get<any[]>('/api/loyalty/my-vouchers', { withCredentials: true });
  }

  redeemCoins(body: { voucherId?: string; cost?: number; description?: string }): Observable<any> {
    return this.http.post('/api/loyalty/redeem', body, { withCredentials: true });
  }

  // ─── Reviews ───
  getMyReviews(): Observable<{ reviews: any[]; pendingReminders: any[]; reminderCount: number }> {
    return this.http.get<{ reviews: any[]; pendingReminders: any[]; reminderCount: number }>('/api/reviews/me', {
      withCredentials: true,
    });
  }

  getReviews(query?: Record<string, string>): Observable<{ reviews: any[]; totalReviews: number; averageRating: number }> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(query || {})) {
      if (v) params = params.set(k, v);
    }
    return this.http.get<{ reviews: any[]; totalReviews: number; averageRating: number }>('/api/reviews', {
      params,
      withCredentials: true,
    });
  }

  createReview(body: { bookingId: string; rating: number; comment?: string }): Observable<any> {
    return this.http.post('/api/reviews', body, { withCredentials: true });
  }
}
