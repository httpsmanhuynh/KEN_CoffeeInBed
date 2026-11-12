import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth.service';
import { KenBookingState, kenMoney } from '../booking-state';
import type { KenBookingDraft } from '../booking-state';

@Component({ selector: 'app-ken-booking-review', standalone: false, templateUrl: './booking-review.html', styleUrl: './booking-review.css' })
export class KenBookingReviewPage {
  feedback = '';
  voucherMessage = '';
  checkingSession = false;
  readonly money = kenMoney;
  constructor(public state: KenBookingState, private router: Router, private auth: AuthService) {}
  setContact(key: 'fullName' | 'phone' | 'email' | 'note' | 'voucher', value: string): void {
    this.state.set({ [key]: value } as Pick<KenBookingDraft, typeof key>);
    this.feedback = '';
  }
  setAgreed(value: boolean): void { this.state.set({ agreed: value }); this.feedback = ''; }
  extraCount(id: string): number { return this.state.draft().extras[id] || 0; }
  drinkCharge(price: number, quantity: number): number {
    return Math.max(0, price - this.state.entitlement) * quantity;
  }
  checkVoucher(): void { this.voucherMessage = 'Mã khuyến mãi chưa kết nối hệ thống. Bản mô phỏng không áp dụng mã này.'; }
  confirm(): void {
    if (this.checkingSession) return;
    this.checkingSession = true;
    this.auth.ensureSession().subscribe({
      next: user => {
        this.checkingSession = false;
        if (!user) {
          this.router.navigate(['/login'], { queryParams: { returnUrl: '/booking/review' } });
          return;
        }
        const draft = this.state.draft();
        this.state.set({
          fullName: draft.fullName || user.fullName,
          phone: draft.phone || user.phone,
          email: draft.email || user.email || '',
        });
        this.confirmAuthenticated();
      },
      error: () => {
        this.checkingSession = false;
        this.router.navigate(['/login'], { queryParams: { returnUrl: '/booking/review' } });
      },
    });
  }

  private confirmAuthenticated(): void {
    const d = this.state.draft();
    if (!this.state.isSlotValid) {
      this.feedback = 'Khung giờ đã chọn chưa hợp lệ hoặc không còn cách hiện tại ít nhất 30 phút. Hãy quay lại chọn ngày giờ.';
    } else if (this.state.requiredDrinkCount > 0 &&
               this.state.selectedDrinkCount !== this.state.requiredDrinkCount) {
      this.feedback = `Vui lòng chọn đủ ${this.state.requiredDrinkCount} đồ uống trước khi xác nhận.`;
    } else if (!d.fullName.trim() || !/^((0|\+84)[0-9]{9,10})$/.test(d.phone.trim()) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) {
      this.feedback = 'Vui lòng nhập họ tên, số điện thoại và email hợp lệ.';
    } else if (!d.agreed) {
      this.feedback = 'Bạn cần đọc và đồng ý với Điều khoản & Chính sách trước khi tiếp tục.';
    } else {
      this.feedback = '';
      this.state.startDemoHold();
      this.router.navigateByUrl('/bookings/payment');
    }
  }

  get selectedExtras() {
    return this.state.extras.filter(extra => this.extraCount(extra.id) > 0);
  }
}
