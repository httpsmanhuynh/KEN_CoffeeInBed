import { Component } from '@angular/core';

@Component({
  selector: 'app-security',
  standalone: false,
  styleUrl: './security.css',
  templateUrl: './security.html',
})
export class Security {
  user = {
    name: 'Thầy Thanh đẹp trai',
    tier: 'Bạc',
    points: '3.250 điểm'
  };

  onSendOtp() {
    console.log('Đã gửi mã OTP qua SMS');
  }

  onSubmitPassword() {
    console.log('Xác nhận OTP & đổi mật khẩu');
  }

  onSetup2FA() {
    console.log('Thiết lập xác thực hai lớp');
  }

  onLogoutSession(device: string) {
    console.log(`Đăng xuất phiên: ${device}`);
  }

  onLogoutOtherDevices() {
    console.log('Đăng xuất các thiết bị khác');
  }

  onRequestDeleteAccount() {
    console.log('Yêu cầu xoá tài khoản');
  }
}
