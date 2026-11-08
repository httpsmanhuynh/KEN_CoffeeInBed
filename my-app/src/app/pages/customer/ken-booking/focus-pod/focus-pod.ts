import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { KenBookingState, KEN_MENU, kenMoney, kenNextDay } from '../booking-state';

@Component({ selector: 'app-ken-focus-booking', standalone: false, templateUrl: './focus-pod.html', styleUrl: './focus-pod.css' })
export class KenFocusPodPage {
  extraCategory: 'all' | 'drink' | 'food' | 'equipment' = 'all';
  feedback = '';
  readonly money = kenMoney;
  readonly hours = Array.from({ length: 14 }, (_, i) => i + 8);
  readonly drinks = KEN_MENU.filter(x => x.category !== 'bakery');
  constructor(public state: KenBookingState, private router: Router) {}
  get minDate(): string { return kenNextDay(); }
  get filteredExtras() { return this.extraCategory === 'all' ? this.state.extras : this.state.extras.filter(x => x.category === this.extraCategory); }
  chooseHours(hours: 1 | 4): void { this.state.set({ hours, drinkId: hours === 1 ? null : this.state.draft().drinkId, holdUntil: null }); this.feedback = ''; }
  changeDate(date: string): void { this.state.set({ date, holdUntil: null }); this.feedback = ''; }
  changeHour(hour: number): void { this.state.set({ startHour: hour, holdUntil: null }); this.feedback = ''; }
  get timeOptions() { return this.hours.filter(h => h + this.state.draft().hours <= 22); }
  extrasCount(id: string): number { return this.state.draft().extras[id] || 0; }
  drinkTopUp(price: number): number { return Math.max(0, price - this.state.entitlement); }
  changeExtra(id: string, by: number): void { this.state.setExtra(id, this.extrasCount(id) + by); }
  chooseDrink(id: string): void { this.state.set({ drinkId: id }); }
  toReview(): void {
    if (!this.state.isSlotValid) {
      this.feedback = 'Vui lòng chọn ngày và giờ bắt đầu trong tương lai, cách hiện tại ít nhất 30 phút, và kết thúc trước 22:00.';
      return;
    }
    if (this.state.draft().hours === 4 && !this.state.draft().drinkId) {
      this.feedback = 'Vui lòng chọn 01 đồ uống đi kèm gói nửa ngày.';
      return;
    }
    this.router.navigateByUrl('/booking/review');
  }
}
