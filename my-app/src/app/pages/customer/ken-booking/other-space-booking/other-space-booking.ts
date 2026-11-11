import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { KenBookingSpace, KenBookingState, kenMoney, kenNextDay } from '../booking-state';

@Component({
  selector: 'app-ken-other-space-booking',
  standalone: false,
  templateUrl: './other-space-booking.html',
  styleUrl: './other-space-booking.css'
})
export class KenOtherSpacePage implements OnInit {
  space?: KenBookingSpace;
  date = kenNextDay();
  startHour = 9;
  guests = 1;
  duration = 1;
  feedback = '';
  extraCategory: 'all' | 'drink' | 'food' | 'equipment' = 'all';

  readonly money = kenMoney;
  readonly allHours = Array.from({ length: 14 }, (_, i) => i + 8);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public state: KenBookingState
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id') || '';
      this.space = this.state.getSpace(id);
      if (!this.space) return;
      if (this.state.draft().spaceId !== id) this.state.set({ spaceId: id });
      const current = this.state.draft();
      this.date = current.date;
      this.startHour = current.startHour;
      this.guests = current.guests;
      this.duration = current.hours;
      this.startHour = Math.min(this.startHour, 22 - this.duration);
      this.feedback = '';
    });
  }

  get minDate(): string { return kenNextDay(); }
  get isFocusZone(): boolean {
    return this.space?.id === 'work' || !!this.space?.id.startsWith('meeting') || this.space?.id === 'focus';
  }
  get zoneLabel(): string { return this.isFocusZone ? 'KÉN TẬP TRUNG' : 'KÉN TÁI TẠO'; }

  get guestOptions(): number[] {
    if (!this.space) return [];
    return Array.from(
      { length: this.space.maxGuests - this.space.minGuests + 1 },
      (_, i) => this.space!.minGuests + i
    );
  }

  chooseDuration(hours: number): void {
    this.duration = hours;
    this.startHour = Math.min(this.startHour, 22 - hours);
    this.state.set({ hours });
    this.feedback = '';
  }

  changeGuests(guests: number): void {
    this.guests = guests;
    this.state.set({ guests });
    this.feedback = '';
  }

  changeDate(date: string): void {
    this.date = date;
    this.state.set({ date });
    this.feedback = '';
  }

  changeHour(hour: number): void {
    this.startHour = hour;
    this.state.set({ startHour: hour });
    this.feedback = '';
  }

  get filteredExtras() {
    return this.extraCategory === 'all'
      ? this.state.extras
      : this.state.extras.filter(extra => extra.category === this.extraCategory);
  }

  extrasCount(id: string): number { return this.state.draft().extras[id] || 0; }
  changeExtra(id: string, delta: number): void {
    this.state.setExtra(id, this.extrasCount(id) + delta);
  }

  openDrinkPicker(): void {
    this.router.navigateByUrl('/booking/drinks');
  }

  get timeOptions(): number[] {
    return this.allHours.filter(hour => hour + this.duration <= 22);
  }

  get needsDrinks(): boolean { return this.state.requiredDrinkCount > 0; }
  get drinksComplete(): boolean {
    return this.state.selectedDrinkCount === this.state.requiredDrinkCount;
  }

  rateLabel(rate: { hours: number; price: number }): string {
    if (this.space?.id === 'work' && rate.hours === 14) return 'Cả ngày · 08:00–22:00';
    if (this.space?.id === 'work' && rate.hours === 4) return 'Nửa ngày · 4 giờ';
    return this.space?.id === 'work' ? 'Linh hoạt · 1 giờ' : `${rate.hours} giờ`;
  }

  toReview(): void {
    if (!this.space) return;
    this.state.set({
      spaceId: this.space.id,
      date: this.date,
      startHour: this.startHour,
      hours: this.duration,
      guests: this.guests,
    });
    if (!this.state.isSlotValid) {
      this.feedback = 'Vui lòng chọn ngày và giờ bắt đầu trong tương lai, cách hiện tại ít nhất 30 phút, và kết thúc trước 22:00.';
      return;
    }
    if (this.needsDrinks && !this.drinksComplete) {
      this.feedback = `Vui lòng chọn đủ ${this.state.requiredDrinkCount} đồ uống theo số khách.`;
      return;
    }
    this.router.navigateByUrl('/booking/review');
  }
}
