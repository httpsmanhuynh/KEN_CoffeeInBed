import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../core/auth.service';

/** Trạng thái lỗi chung của form (khớp các frame Figma). */
type FormError = 'none' | 'invalid' | 'duplicate' | 'rate-limit' | 'server';

/** Mật khẩu tối đa 72 byte UTF-8 (giới hạn bcrypt, TC-PW-01..03). */
const maxBytes =
  (max: number): ValidatorFn =>
  (c: AbstractControl): ValidationErrors | null =>
    new TextEncoder().encode(c.value ?? '').length > max ? { maxBytes: true } : null;

const passwordsMatch: ValidatorFn = (g: AbstractControl): ValidationErrors | null => {
  const p = g.get('password')?.value;
  const c = g.get('confirmPassword')?.value;
  return p && c && p !== c ? { mismatch: true } : null;
};

const notFuture: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  c.value && new Date(c.value) > new Date() ? { future: true } : null;

@Component({
  selector: 'app-register-page',
  standalone: false,
  templateUrl: './register-page.html',
  styleUrl: './register-page.css',
})
export class RegisterPage {
  // Tiêm các service bằng hàm inject() để khởi tạo trước khi tạo thuộc tính form
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  get returnUrl(): string | null {
    const value = this.route.snapshot.queryParamMap.get('returnUrl');
    return value?.startsWith('/') && !value.startsWith('//') ? value : null;
  }

  readonly today = new Date().toISOString().split('T')[0];

  showPassword = false;
  showConfirm = false;
  loading = false;
  formError: FormError = 'none';

  readonly form = this.fb.nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.email, Validators.maxLength(100)]], // không bắt buộc (BR-A03)
      phone: ['', [Validators.required, Validators.pattern(/^(?:\+84|84|0)(?:3|5|7|8|9)\d{8}$/)]],
      dateOfBirth: ['', [Validators.required, notFuture]], // bắt buộc theo BR-A03
      password: ['', [Validators.required, Validators.minLength(8), maxBytes(72)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  constructor() {
    // Người dùng sửa dữ liệu thì xóa thông báo lỗi chung (vd. "đã được sử dụng").
    this.form.valueChanges.subscribe(() => {
      if (this.formError !== 'none') this.formError = 'none';
    });
  }

  /** Hiện lỗi của một ô sau khi người dùng đã chạm vào hoặc đã bấm Gửi. */
  showError(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && c.touched;
  }

  fieldMessage(name: string): string {
    const e = this.form.get(name)?.errors;
    if (!e) return '';
    switch (name) {
      case 'fullName':
        return e['required'] ? 'Vui lòng nhập họ và tên.' : 'Họ và tên từ 2 đến 100 ký tự.';
      case 'email':
        return 'Email chưa đúng định dạng.';
      case 'phone':
        return e['required'] ? 'Vui lòng nhập số điện thoại.' : 'Số điện thoại chưa đúng định dạng.';
      case 'dateOfBirth':
        return e['required'] ? 'Vui lòng chọn ngày sinh.' : 'Ngày sinh không hợp lệ.';
      case 'password':
        return e['required']
          ? 'Vui lòng nhập mật khẩu.'
          : e['minlength']
            ? 'Mật khẩu tối thiểu 8 ký tự.'
            : 'Mật khẩu quá dài (tối đa 72 byte).';
      case 'confirmPassword':
        return 'Vui lòng nhập lại mật khẩu.';
    }
    return '';
  }

  get mismatch(): boolean {
    return !!this.form.errors?.['mismatch'] && !!this.form.get('confirmPassword')?.touched;
  }

  get errorText(): string {
    switch (this.formError) {
      case 'invalid':
        return 'Vui lòng nhập đầy đủ thông tin bắt buộc.';
      case 'duplicate':
        return 'Email hoặc số điện thoại đã được sử dụng.';
      case 'rate-limit':
        return 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.';
      case 'server':
        return 'Có lỗi xảy ra. Vui lòng thử lại.';
      default:
        return '';
    }
  }

  submit(): void {
    if (this.loading) return;
    this.formError = 'none';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError = 'invalid';
      return;
    }

    const v = this.form.getRawValue();
    this.loading = true;
    this.auth
      .register({
        fullName: v.fullName.trim(),
        email: v.email.trim() || undefined,
        phone: v.phone.trim(),
        dateOfBirth: v.dateOfBirth,
        password: v.password,
      })
      .subscribe({
        // 201: đã gửi OTP → sang bước nhập OTP (tài khoản chỉ tạo sau khi OTP đúng, BR-A03)
        next: () => this.router.navigate(['/otp-verify'], {
          queryParams: this.returnUrl ? { returnUrl: this.returnUrl } : undefined,
          state: { phone: v.phone.trim() },
        }),
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.formError =
            err.status === 409 ? 'duplicate'
            : err.status === 422 ? 'invalid'
            : err.status === 429 ? 'rate-limit'
            : 'server';
        },
        complete: () => (this.loading = false),
      });
  }
}