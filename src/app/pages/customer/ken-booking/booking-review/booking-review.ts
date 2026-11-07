import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { KenBookingState, kenMoney } from '../booking-state';
import type { KenBookingDraft } from '../booking-state';

@Component({ selector: 'app-ken-booking-review', standalone: false, templateUrl: './booking-review.html', styleUrl: './booking-review.css' })
export class KenBookingReviewPage {
  feedback = '';
  voucherMessage = '';
  readonly money = kenMoney;
  constructor(public state: KenBookingState, private router: Router) {}
  setContact(key: 'fullName' | 'phone' | 'email' | 'note' | 'voucher', value: string): void {
    this.state.set({ [key]: value } as Pick<KenBookingDraft, typeof key>);
    this.feedback = '';
  }
  setAgreed(value: boolean): void { this.state.set({ agreed: value }); this.feedback = ''; }
  extraCount(id: string): number { return this.state.draft().extras[id] || 0; }
  checkVoucher(): void { this.voucherMessage = 'Mã khuyến mãi chưa kết nối hệ thống. Bản mô phỏng không áp dụng mã này.'; }
  confirm(): void {
    const d = this.state.draft();
    if (!this.state.isSlotValid) {
      this.feedback = 'Khung giờ đã chọn chưa hợp lệ hoặc không còn cách hiện tại ít nhất 30 phút. Hãy quay lại chọn ngày giờ.';
    } else if (!d.fullName.trim() || !/^((0|\+84)[0-9]{9,10})$/.test(d.phone.trim()) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) {
      this.feedback = 'Vui lòng nhập họ tên, số điện thoại và email hợp lệ.';
    } else if (!d.agreed) {
      this.feedback = 'Bạn cần đọc và đồng ý với Điều khoản & Chính sách trước khi tiếp tục.';
    } else {
      this.feedback = '';
      this.state.startDemoHold();
      this.router.navigateByUrl('/booking/payment');
    }
  }
}
