import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth.service';
import { CustomerApiService } from '../../../../core/customer-api.service';

interface SessionItem {
  id: string;
  name: string;
  desc: string;
  isCurrent: boolean;
}

@Component({
  selector: 'app-security',
  standalone: false,
  styleUrl: './security.css',
  templateUrl: './security.html',
})
export class Security implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService, { optional: true });
  private readonly api = inject(CustomerApiService, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly cdr = inject(ChangeDetectorRef, { optional: true });

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  otpCode = '';

  showCurrent = false;
  showNew = false;
  showConfirm = false;

  sendingOtp = false;
  submittingPassword = false;
  pwMessage = '';
  pwMessageType: 'ok' | 'error' | '' = '';
  otpCooldown = 0;
  private timer?: ReturnType<typeof setInterval>;

  twoFactorEnabled = false;
  twoFactorPassword = '';
  twoFactorOtp = '';
  twoFactorStep: 'idle' | 'configuring' = 'idle';
  twoFactorLoading = false;
  twoFactorMessage = '';

  sessions: SessionItem[] = [
    { id: 'cur', name: 'Chrome · macOS (Thiết bị hiện tại)', desc: 'Máy tính · TP. Hồ Chí Minh · Hoạt động ngay lúc này', isCurrent: true },
    { id: 's2', name: 'Safari · iPhone', desc: 'Điện thoại · TP. Hồ Chí Minh · 22/10/2026, 20:15', isCurrent: false },
  ];
  sessionMessage = '';

  ngOnInit(): void {
    this.auth?.ensureSession().subscribe({
      next: (user) => {
        if (!user) return;
        this.twoFactorEnabled = !!user.twoFactorEnabled;
        const ua = navigator.userAgent;
        const isMobile = /Android|iPhone|iPad/i.test(ua);
        const browser = ua.includes('Chrome') ? 'Chrome' : ua.includes('Safari') ? 'Safari' : ua.includes('Firefox') ? 'Firefox' : 'Trình duyệt web';
        const os = ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS' : ua.includes('Android') ? 'Android' : ua.includes('iPhone') ? 'iOS' : 'Thiết bị';
        this.sessions[0].name = `${browser} · ${os} (Phiên hiện tại)`;
        this.cdr?.markForCheck();
      },
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  startCooldown(): void {
    clearInterval(this.timer);
    this.otpCooldown = 60;
    this.timer = setInterval(() => {
      if (--this.otpCooldown <= 0) {
        this.otpCooldown = 0;
        clearInterval(this.timer);
      }
      this.cdr?.markForCheck();
    }, 1000);
  }

  onSendOtp(): void {
    if (this.otpCooldown > 0 || this.sendingOtp) return;
    if (!this.api) return;
    this.sendingOtp = true;
    this.pwMessage = '';
    this.api.sendProfileOtp({ purpose: 'CHANGE_PASSWORD' }).subscribe({
      next: () => {
        this.sendingOtp = false;
        this.pwMessageType = 'ok';
        this.pwMessage = 'Đã gửi mã OTP đến email của bạn. Vui lòng kiểm tra hộp thư.';
        this.startCooldown();
        this.cdr?.markForCheck();
      },
      error: (err) => {
        this.sendingOtp = false;
        this.pwMessageType = 'error';
        this.pwMessage = err.error?.message || 'Không thể gửi mã OTP. Vui lòng thử lại sau.';
        this.cdr?.markForCheck();
      },
    });
  }

  onSubmitPassword(): void {
    if (this.submittingPassword) return;
    this.pwMessage = '';
    if (!this.currentPassword) {
      this.pwMessageType = 'error';
      this.pwMessage = 'Vui lòng nhập mật khẩu hiện tại.';
      return;
    }
    if (!this.newPassword || this.newPassword.length < 8) {
      this.pwMessageType = 'error';
      this.pwMessage = 'Mật khẩu mới tối thiểu 8 ký tự.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.pwMessageType = 'error';
      this.pwMessage = 'Mật khẩu xác nhận không khớp.';
      return;
    }
    if (!this.otpCode || this.otpCode.length !== 6) {
      this.pwMessageType = 'error';
      this.pwMessage = 'Vui lòng nhập đủ 6 chữ số mã OTP.';
      return;
    }
    if (!this.api) return;
    this.submittingPassword = true;
    this.api.changePassword({
      currentPassword: this.currentPassword,
      newPassword: this.newPassword,
      confirmPassword: this.confirmPassword,
      code: this.otpCode.trim(),
    }).subscribe({
      next: () => {
        this.submittingPassword = false;
        this.pwMessageType = 'ok';
        this.pwMessage = 'Đã đổi mật khẩu thành công.';
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.otpCode = '';
        this.cdr?.markForCheck();
      },
      error: (err) => {
        this.submittingPassword = false;
        this.pwMessageType = 'error';
        this.pwMessage = err.error?.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại thông tin.';
        this.cdr?.markForCheck();
      },
    });
  }

  onSetup2FA(): void {
    this.twoFactorStep = this.twoFactorStep === 'idle' ? 'configuring' : 'idle';
    this.twoFactorMessage = '';
  }

  onSend2FAOtp(): void {
    if (!this.api) return;
    this.twoFactorMessage = '';
    this.api.sendProfileOtp({ purpose: 'TOGGLE_2FA' }).subscribe({
      next: () => {
        this.twoFactorMessage = 'Đã gửi mã OTP đến email để xác nhận bật/tắt 2FA.';
        this.cdr?.markForCheck();
      },
      error: (err) => {
        this.twoFactorMessage = err.error?.message || 'Không thể gửi mã OTP.';
        this.cdr?.markForCheck();
      },
    });
  }

  onToggle2FA(): void {
    if (!this.api || !this.twoFactorPassword || !this.twoFactorOtp) {
      this.twoFactorMessage = 'Vui lòng nhập mật khẩu hiện tại và mã OTP.';
      return;
    }
    this.twoFactorLoading = true;
    this.api.toggle2FA({
      enabled: !this.twoFactorEnabled,
      currentPassword: this.twoFactorPassword,
      code: this.twoFactorOtp.trim(),
    }).subscribe({
      next: (res) => {
        this.twoFactorLoading = false;
        this.twoFactorEnabled = res.twoFactorEnabled;
        this.twoFactorStep = 'idle';
        this.twoFactorPassword = '';
        this.twoFactorOtp = '';
        this.twoFactorMessage = res.twoFactorEnabled ? 'Đã bật xác thực hai lớp (2FA).' : 'Đã tắt xác thực hai lớp.';
        if (this.auth?.user) this.auth.setUser({ ...this.auth.user, twoFactorEnabled: res.twoFactorEnabled });
        this.cdr?.markForCheck();
      },
      error: (err) => {
        this.twoFactorLoading = false;
        this.twoFactorMessage = err.error?.message || 'Không thể cập nhật 2FA.';
        this.cdr?.markForCheck();
      },
    });
  }

  onLogoutSession(id: string): void {
    this.sessions = this.sessions.filter(s => s.id !== id);
    this.sessionMessage = 'Đã đăng xuất phiên làm việc.';
  }

  onLogoutOtherDevices(): void {
    this.sessions = this.sessions.filter(s => s.isCurrent);
    this.sessionMessage = 'Đã đăng xuất tất cả các thiết bị khác.';
  }

  onRequestDeleteAccount(): void {
    alert('Yêu cầu xoá tài khoản đã được ghi nhận. Ban quản trị KÉN sẽ liên hệ với bạn để hoàn tất quy trình.');
  }

  logout(): void {
    if (!this.auth) return;
    this.auth.logout().subscribe({ next: () => this.router?.navigateByUrl('/') });
  }
}
