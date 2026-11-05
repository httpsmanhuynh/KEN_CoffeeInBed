import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../core/auth.service';

/** Trạng thái lỗi chung (khớp các frame Figma). */
type LoginError = 'none' | 'invalid' | 'locked' | 'rate-limit' | 'server';

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

  readonly form: FormGroup;

  constructor(
    private fb: FormBuilder,
    @Inject(AuthService) private auth: AuthService,
    private router: Router,
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
        // Tài khoản bật 2FA → sang bước nhập OTP 2FA (trang này chưa thiết kế).
        if (res?.twoFactorRequired) this.router.navigate(['/login/2fa']);
        else this.router.navigate(['/']);
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
