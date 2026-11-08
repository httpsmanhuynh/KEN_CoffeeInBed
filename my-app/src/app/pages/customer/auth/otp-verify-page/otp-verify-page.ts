import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../core/auth.service';
import { OtpInput } from '../../../../shared/components/otp-input/otp-input';

const COOLDOWN_SECONDS = 60;

@Component({
  selector: 'app-otp-verify-page',
  standalone: false,
  templateUrl: './otp-verify-page.html',
  styleUrl: './otp-verify-page.css',
})
export class OtpVerifyPage implements OnInit, OnDestroy {
  @ViewChild(OtpInput) otp?: OtpInput;

  phone = '';
  masked = '';
  code = '';
  loading = false;
  resending = false;
  error = '';
  info = '';
  cooldown = COOLDOWN_SECONDS;
  private timer?: ReturnType<typeof setInterval>;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    // SĐT được truyền từ trang Đăng ký. Tải lại trang sẽ mất → quay về Đăng ký.
    const phone = (history.state as { phone?: string } | null)?.phone;
    if (!phone) { this.router.navigate(['/register']); return; }
    this.phone = phone;
    this.masked = this.mask(phone);
    this.startCooldown();
  }

  ngOnDestroy(): void { clearInterval(this.timer); }

  /** 0901234678 → 09•• ••• 678 */
  private mask(p: string): string {
    const n = p.startsWith('+84') ? '0' + p.slice(3) : p.startsWith('84') ? '0' + p.slice(2) : p;
    return `${n.slice(0, 2)}•• ••• ${n.slice(-3)}`;
  }

  private startCooldown(): void {
    clearInterval(this.timer);
    this.cooldown = COOLDOWN_SECONDS;
    this.timer = setInterval(() => {
      if (--this.cooldown <= 0) clearInterval(this.timer);
    }, 1000);
  }

  onCodeChange(v: string): void {
    this.code = v;
    this.error = '';
  }

  get canSubmit(): boolean { return this.code.length === 6 && !this.loading; }

  verify(): void {
    if (this.code.length !== 6) { this.error = 'Vui lòng nhập đủ 6 chữ số.'; return; }
    if (this.loading) return;
    this.loading = true;
    this.error = '';
    this.auth.verifyOtp({ phone: this.phone, code: this.code }).subscribe({
      next: () => this.router.navigate(['/login'], { state: { registered: true } }),
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.error = this.messageFor(err);
        this.otp?.clear();
      },
    });
  }

  resend(): void {
    if (this.cooldown > 0 || this.resending) return;
    this.resending = true;
    this.error = '';
    this.auth.resendOtp(this.phone).subscribe({
      next: () => {
        this.resending = false;
        this.info = 'Đã gửi lại mã OTP.';
        this.otp?.clear();
        this.startCooldown();
      },
      error: (err: HttpErrorResponse) => {
        this.resending = false;
        this.error = err.status === 429
          ? 'Bạn yêu cầu mã quá nhiều lần. Vui lòng thử lại sau ít phút.'
          : 'Không gửi lại được mã. Vui lòng thử lại.';
      },
    });
  }

  private messageFor(err: HttpErrorResponse): string {
    const code: string = err.error?.code ?? '';
    if (err.status === 429 || code === 'OTP_TOO_MANY_ATTEMPTS')
      return 'Bạn đã nhập sai quá nhiều lần. Vui lòng gửi lại mã mới.';
    if (err.status === 409) return 'Email hoặc số điện thoại đã được sử dụng.';
    if (code.includes('EXPIRED')) return 'Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.';
    if (err.status === 422) return 'Mã OTP không đúng. Vui lòng kiểm tra lại.';
    return 'Có lỗi xảy ra. Vui lòng thử lại.';
  }

  backToRegister(): void { this.router.navigate(['/register']); }
}
