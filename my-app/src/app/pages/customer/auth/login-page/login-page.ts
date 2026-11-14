import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../core/auth.service';

/** Trạng thái lỗi chung (khớp các frame Figma). */
type LoginError = 'none' | 'invalid' | 'locked' | 'rate-limit' | 'server' | 'two-factor-unavailable';

@Component({
  selector: 'app-login-page',
  standalone: false,
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  showPassword = false;
  loading = false;
  error: LoginError = 'none';
  /** Vừa đăng ký xong (nhận từ trang OTP) → hiện lời chào. */
  readonly justRegistered = !!(history.state as { registered?: boolean } | null)?.registered;

  /** Vừa đặt lại mật khẩu xong (nhận từ trang Đặt lại mật khẩu). */
  readonly justReset = !!(history.state as { passwordReset?: boolean } | null)?.passwordReset;

  readonly form: FormGroup;

  get requiresLogin(): boolean {
    return !!this.route.snapshot.queryParamMap.get('returnUrl');
  }

  get returnUrl(): string | null {
    const value = this.route.snapshot.queryParamMap.get('returnUrl');
    return value?.startsWith('/') && !value.startsWith('//') ? value : null;
  }

  constructor(
    private fb: FormBuilder,
    @Inject(AuthService) private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.form = this.fb.nonNullable.group({
      identifier: ['', [Validators.required, Validators.maxLength(100)]],
      password: ['', [Validators.required]],
    });
    // Sửa dữ liệu thì xóa thông báo lỗi chung.
    this.form.valueChanges.subscribe(() => {
      if (this.error !== 'none') this.error = 'none';
    });
  }

  showFieldError(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && c.touched;
  }

  get errorText(): string {
    switch (this.error) {
      case 'invalid':
        return 'Thông tin đăng nhập không chính xác. Vui lòng thử lại.';
      case 'rate-limit':
        return 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.';
      case 'server':
        return 'Có lỗi xảy ra. Vui lòng thử lại.';
      case 'two-factor-unavailable':
        return 'Tài khoản yêu cầu xác thực hai bước, nhưng màn hình xác thực 2FA chưa được triển khai.';
      default:
        return '';
    }
  }

  submit(): void {
    if (this.loading) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.loading = true;
    this.error = 'none';

    this.auth.login({ identifier: v.identifier.trim(), password: v.password }).subscribe({
      next: (res) => {
        if (res?.requires2FA) {
          this.loading = false;
          const id = v.identifier.trim();
          const isEmail = id.includes('@');
          try {
            sessionStorage.setItem('ken_2fa_identifier', id);
          } catch {}
          this.router.navigate(['/otp-verify'], {
            queryParams: {
              mode: 'login-2fa',
              ...(this.returnUrl ? { returnUrl: this.returnUrl } : {}),
            },
            state: {
              mode: 'login-2fa',
              identifier: id,
              email: isEmail ? id : undefined,
              phone: !isEmail ? id : undefined,
            },
          });
        } else {
          const defaultHome = res?.user?.role === 'ADMIN' ? '/admin/dashboard' : '/home-logged-in';
          const destination = this.returnUrl ?? defaultHome;
          this.router.navigateByUrl(destination);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.error =
          err.status === 401 ? 'invalid'
          : err.status === 403 ? 'locked'
          : err.status === 429 ? 'rate-limit'
          : 'server';
      },
      complete: () => (this.loading = false),
    });
  }
}
