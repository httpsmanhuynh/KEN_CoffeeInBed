import { Component, Inject, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../core/auth.service';

/** Mật khẩu tối đa 72 byte UTF-8 (giới hạn bcrypt) — giống trang Đăng ký. */
const maxBytes: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  new TextEncoder().encode(c.value ?? '').length > 72 ? { maxBytes: true } : null;

const passwordsMatch: ValidatorFn = (g: AbstractControl): ValidationErrors | null => {
  const p = g.get('password')?.value;
  const c = g.get('confirmPassword')?.value;
  return p && c && p !== c ? { mismatch: true } : null;
};

@Component({
  selector: 'app-reset-password-page',
  standalone: false,
  templateUrl: './reset-password-page.html',
  styleUrls: [
    '../login-page/login-page.css',
    '../forgot-password/forgot-password.css',
    './reset-password-page.css',
  ],
})
export class ResetPasswordPage implements OnInit {
  showPassword = false;
  showConfirm = false;
  loading = false;
  error = '';
  /** Token hết hạn → hiện nút "Bắt đầu lại". */
  expired = false;

  private phone = '';
  private resetToken = '';
  readonly form: FormGroup;

  constructor(private fb: FormBuilder, @Inject(AuthService) private auth: AuthService, private router: Router) {
    this.form = this.fb.nonNullable.group(
      {
        password: ['', [Validators.required, Validators.minLength(8), maxBytes]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: passwordsMatch },
    );
    this.form.valueChanges.subscribe(() => { if (!this.expired) this.error = ''; });
  }

  ngOnInit(): void {
    // Chỉ vào được sau khi xác thực OTP. Tải lại/vào thẳng URL → quay về bước 1.
    const s = history.state as { phone?: string; resetToken?: string } | null;
    if (!s?.phone || !s?.resetToken) { this.router.navigate(['/forgot-password']); return; }
    this.phone = s.phone;
    this.resetToken = s.resetToken;
  }

  showFieldError(name: 'password' | 'confirmPassword'): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && c.touched;
  }

  fieldMessage(name: 'password' | 'confirmPassword'): string {
    const e = this.form.get(name)?.errors;
    if (!e) return '';
    if (name === 'confirmPassword') return 'Vui lòng nhập lại mật khẩu.';
    return e['required'] ? 'Vui lòng nhập mật khẩu mới.'
      : e['minlength'] ? 'Mật khẩu tối thiểu 8 ký tự.'
      : 'Mật khẩu quá dài (tối đa 72 byte).';
  }

  get mismatch(): boolean {
    return !!this.form.errors?.['mismatch'] && this.form.get('confirmPassword')!.touched;
  }

  submit(): void {
    if (this.loading) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.error = '';
    this.auth.resetPassword({
      phone: this.phone,
      resetToken: this.resetToken,
      newPassword: this.form.getRawValue().password,
    }).subscribe({
      next: () => this.router.navigate(['/login'], { state: { passwordReset: true } }),
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        const code: string = err.error?.code ?? '';
        if (err.status === 401 || err.status === 410 || code.includes('TOKEN') || code.includes('EXPIRED')) {
          this.expired = true;
          this.error = 'Phiên đặt lại mật khẩu đã hết hạn. Vui lòng thực hiện lại từ đầu.';
        } else if (err.status === 422) this.error = 'Mật khẩu không hợp lệ. Vui lòng kiểm tra lại.';
        else if (err.status === 429) this.error = 'Bạn thử quá nhiều lần. Vui lòng thử lại sau ít phút.';
        else this.error = 'Có lỗi xảy ra. Vui lòng thử lại.';
      },
    });
  }
}
