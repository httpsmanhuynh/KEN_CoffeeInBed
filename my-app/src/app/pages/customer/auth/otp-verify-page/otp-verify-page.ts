import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
  email = '';
  masked = '';
  code = '';
  loading = false;
  resending = false;
  error = '';
  info = '';
  cooldown = COOLDOWN_SECONDS;
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  private get returnUrl(): string | null {
    const value = this.route.snapshot.queryParamMap.get('returnUrl');
    return value?.startsWith('/') && !value.startsWith('//') ? value : null;
  }

  ngOnInit(): void {
    const state = history.state as { phone?: string; email?: string } | null;
    const phone = state?.phone;
    const email = state?.email;
    if (!phone && !email) {
      this.router.navigate(['/register']);
      return;
    }
    this.phone = phone || '';
    this.email = email || '';
    this.masked = this.email ? this.maskEmail(this.email) : this.mask(this.phone);
    this.startCooldown();
  }

  /** Mask email dạng k***n@domain.com */
  private maskEmail(em: string): string {
    const parts = em.split('@');
    if (parts.length !== 2) return em;
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) return `${name[0]}*@${domain}`;
    return `${name.slice(0, 2)}••••${name.slice(-1)}@${domain}`;
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
    this.cdr.detectChanges();
    this.timer = setInterval(() => {
      if (--this.cooldown <= 0) {
        this.cooldown = 0;
        clearInterval(this.timer);
      }
      this.cdr.detectChanges();
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
    this.auth.verifyOtp({ phone: this.phone || this.email, code: this.code }).subscribe({
      next: () => {
        try { sessionStorage.removeItem('ken_reg_draft'); } catch {}
        this.router.navigate(['/login'], {
          queryParams: this.returnUrl ? { returnUrl: this.returnUrl } : undefined,
          state: { registered: true },
        });
      },
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
    this.auth.resendOtp(this.phone || this.email).subscribe({
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

  backToRegister(): void {
    this.router.navigate(['/register'], {
      queryParams: this.returnUrl ? { returnUrl: this.returnUrl } : undefined,
    });
  }
}
