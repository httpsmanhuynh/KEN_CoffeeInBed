import { Component, Inject } from '@angular/core';
import { AbstractControl, FormControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../core/auth.service';

const VN_PHONE = /^(?:\+84|84|0)[35789]\d{8}$/;

/** Cho phép nhập có khoảng trắng/chấm/gạch (VD: 0912 345 678) — chuẩn hóa trước khi kiểm tra. */
export const normalizePhone = (v: string): string => (v ?? '').replace(/[\s.\-]/g, '');
const vnPhone: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = normalizePhone(c.value);
  return !v || VN_PHONE.test(v) ? null : { pattern: true };
};

@Component({
  selector: 'app-forgot-password',
  standalone: false,
  templateUrl: './forgot-password.html',
  styleUrls: ['../login-page/login-page.css', './forgot-password.css'],
})
export class ForgotPasswordPage {
  readonly phone = new FormControl('', { nonNullable: true, validators: [Validators.required, vnPhone] });
  loading = false;
  error = '';

  constructor(@Inject(AuthService) private auth: AuthService, private router: Router) {
    this.phone.valueChanges.subscribe(() => (this.error = ''));
  }

  get fieldError(): string {
    if (!this.phone.touched || this.phone.valid) return '';
    return this.phone.errors?.['required'] ? 'Vui lòng nhập số điện thoại.' : 'Số điện thoại chưa đúng định dạng.';
  }

  submit(): void {
    if (this.loading) return;
    if (this.phone.invalid) { this.phone.markAsTouched(); return; }
    const phone = normalizePhone(this.phone.value);
    this.loading = true;
    this.error = '';
    this.auth.forgotPassword(phone).subscribe({
      next: () => this.router.navigate(['/forgot-otp'], { state: { phone } }),
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.error =
          err.status === 404 ? 'Số điện thoại này chưa được đăng ký tài khoản.'
          : err.status === 422 ? 'Số điện thoại chưa đúng định dạng.'
          : err.status === 429 ? 'Bạn yêu cầu mã quá nhiều lần. Vui lòng thử lại sau ít phút.'
          : 'Có lỗi xảy ra. Vui lòng thử lại.';
      },
    });
  }
}
