import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RegisterPayload {
  fullName: string;
  email?: string;
  phone: string;
  dateOfBirth: string;
  password: string;
}

/** Kết quả đăng nhập. TODO: đối chiếu tên trường 2FA với backend (giả định twoFactorRequired). */
export interface LoginResult {
  twoFactorRequired?: boolean;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Server: http://localhost:3002 (đặt proxy.conf.json để /api chuyển sang cổng này)
  private readonly base = '/api/auth';

  constructor(private http: HttpClient) {}

  /** 201 = đã gửi OTP · 409 = trùng SĐT/email · 422 = dữ liệu sai · 429 = quá hạn mức gửi OTP */
  register(body: RegisterPayload): Observable<unknown> {
    return this.http.post(`${this.base}/register`, body, { withCredentials: true });
  }

  /** Xác minh OTP đăng ký. 200/201 = tạo tài khoản · 422 = sai/hết hạn · 429 = nhập sai quá 5 lần · 409 = trùng email */
  /** Đăng nhập. 200 = ok · 401 INVALID_CREDENTIALS · 403 = tài khoản bị khóa/không ACTIVE · 429 = thử quá nhiều */
  login(body: { identifier: string; password: string }): Observable<LoginResult> {
    return this.http.post<LoginResult>(`${this.base}/login`, body, { withCredentials: true });
  }

  verifyOtp(body: { phone: string; code: string }): Observable<unknown> {
    return this.http.post(`${this.base}/verify-otp`, body, { withCredentials: true });
  }

  /** Gửi lại OTP đăng ký. TODO: xác nhận đúng đường dẫn với backend (giả định /resend-otp). */
  resendOtp(phone: string): Observable<unknown> {
    return this.http.post(`${this.base}/resend-otp`, { phone }, { withCredentials: true });
  }
}
