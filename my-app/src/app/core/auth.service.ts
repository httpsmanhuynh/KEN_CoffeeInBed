import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, finalize, shareReplay, tap } from 'rxjs/operators';

export interface RegisterPayload {
  fullName: string;
  email?: string;
  phone: string;
  dateOfBirth: string;
  password: string;
}

export interface AuthenticatedUser {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: string;
  twoFactorEnabled: boolean;
  membershipTier: string;
  tierPoints: number;
  coinsBalance: number;
}

export interface LoginResult {
  requires2FA?: boolean;
  user?: AuthenticatedUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Server: http://localhost:3002 (đặt proxy.conf.json để /api chuyển sang cổng này)
  private readonly base = '/api/auth';
  private readonly currentUser = signal<AuthenticatedUser | null>(null);
  private sessionChecked = false;
  private sessionRequest?: Observable<AuthenticatedUser | null>;

  constructor(private http: HttpClient) {}

  get user(): AuthenticatedUser | null {
    return this.currentUser();
  }

  get isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  /** Tải danh tính từ phiên cookie hiện tại; 401 chỉ có nghĩa là khách vãng lai. */
  loadSession(): Observable<AuthenticatedUser | null> {
    if (this.sessionChecked) return of(this.currentUser());
    if (this.sessionRequest) return this.sessionRequest;

    this.sessionRequest = this.http.get<AuthenticatedUser>(`${this.base}/me`, { withCredentials: true }).pipe(
      tap(user => {
        this.setUser(user);
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.setUser(null);
          return of(null);
        }
        return throwError(() => error);
      }),
      finalize(() => {
        this.sessionRequest = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.sessionRequest;
  }

  /** Kiểm tra phiên trước các thao tác yêu cầu tài khoản. */
  ensureSession(): Observable<AuthenticatedUser | null> {
    return this.sessionChecked ? of(this.currentUser()) : this.loadSession();
  }

  setUser(user: AuthenticatedUser | null): void {
    this.currentUser.set(user);
    this.sessionChecked = true;
  }

  /** 201 = đã gửi OTP · 409 = trùng SĐT/email · 422 = dữ liệu sai · 429 = quá hạn mức gửi OTP */
  register(body: RegisterPayload): Observable<unknown> {
    return this.http.post(`${this.base}/register`, body, { withCredentials: true });
  }

  /** Đăng nhập. 200 = ok · 401 INVALID_CREDENTIALS · 403 = tài khoản bị khóa/không ACTIVE · 429 = thử quá nhiều */
  login(body: { identifier: string; password: string }): Observable<LoginResult> {
    return this.http.post<LoginResult>(`${this.base}/login`, body, { withCredentials: true }).pipe(
      tap(result => {
        if (!result.requires2FA && result.user) this.setUser(result.user);
      }),
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/logout`, {}, { withCredentials: true }).pipe(
      tap(() => this.setUser(null)),
    );
  }

  verifyOtp(body: { phone: string; code: string }): Observable<unknown> {
    return this.http.post(`${this.base}/verify-otp`, body, { withCredentials: true });
  }

  /** Gửi lại OTP đăng ký. TODO: xác nhận đúng đường dẫn với backend (giả định /resend-otp). */
  resendOtp(phone: string): Observable<unknown> {
    return this.http.post(`${this.base}/resend-otp`, { phone }, { withCredentials: true });
  }

  // ───────── Quên mật khẩu (3 bước: SĐT → OTP → mật khẩu mới) ─────────
  // TODO: xác nhận đường dẫn + tên trường với backend (đang giả định bên dưới).

  /** Bước 1 – gửi OTP. Cũng dùng để gửi lại OTP. 200 = đã gửi · 404 = SĐT chưa đăng ký · 422 = sai định dạng · 429 = quá hạn mức */
  forgotPassword(phone: string): Observable<unknown> {
    return this.http.post(`${this.base}/forgot-password`, { phone }, { withCredentials: true });
  }

  /** Bước 2 – xác minh OTP, trả về resetToken dùng 1 lần. 422 = sai/hết hạn · 429 = nhập sai quá 5 lần */
  verifyResetOtp(body: { phone: string; code: string }): Observable<{ resetToken?: string }> {
    return this.http.post<{ resetToken?: string }>(`${this.base}/forgot-password/verify-otp`, body, { withCredentials: true });
  }

  /** Bước 3 – đặt mật khẩu mới. 200 = ok · 401/410 = token hết hạn · 422 = mật khẩu không hợp lệ */
  resetPassword(body: { phone: string; resetToken: string; newPassword: string }): Observable<unknown> {
    return this.http.post(`${this.base}/reset-password`, body, { withCredentials: true });
  }
}
