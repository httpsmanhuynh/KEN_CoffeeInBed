import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../../core/auth.service';
import { KenBookingState, kenMoney, kenNextDay } from '../booking-state';
import { KenAvailabilityService } from '../availability.service';

@Component({ selector: 'app-ken-focus-booking', standalone: false, templateUrl: './focus-pod.html', styleUrl: './focus-pod.css' })
export class KenFocusPodPage implements OnInit {
  extraCategory: 'all' | 'drink' | 'food' | 'equipment' = 'all';
  feedback = '';
  showAddons = false;
  checkingSession = false;
  checkingAvailability = false;
  readonly money = kenMoney;
  readonly hours = Array.from({ length: 14 }, (_, i) => i + 8);
  constructor(
    public state: KenBookingState,
    private router: Router,
    private auth: AuthService,
    private route: ActivatedRoute,
    private availability: KenAvailabilityService,
    private changeDetector: ChangeDetectorRef,
  ) {}
  ngOnInit(): void {
    if (!this.state.isFocusSpace) this.state.set({ spaceId: 'focus', guests: 1 });
    if (this.route.snapshot.queryParamMap.get('bookingStep') === 'addons') {
      this.restoreAddonsStep();
    }
  }
  get minDate(): string { return kenNextDay(); }
  get filteredExtras() { return this.extraCategory === 'all' ? this.state.extras : this.state.extras.filter(x => x.category === this.extraCategory); }
  get hourlyDurationOptions(): number[] {
    const maxHours = Math.max(1, 22 - this.state.draft().startHour);
    return Array.from({ length: maxHours }, (_, i) => i + 1);
  }
  chooseHours(hours: number): void {
    this.state.set({
      hours,
      drinkId: hours === 4 ? this.state.draft().drinkId : null,
      drinkQuantities: hours === 4 ? this.state.draft().drinkQuantities : {},
      holdUntil: null
    });
    this.showAddons = false;
    this.feedback = '';
  }
  changeDate(date: string): void {
    this.state.set({ date, holdUntil: null });
    this.showAddons = false;
    this.feedback = '';
  }
  changeHour(hour: number): void {
    this.state.set({ startHour: hour, holdUntil: null });
    this.showAddons = false;
    this.feedback = '';
  }
  get timeOptions() { return this.hours.filter(h => h + this.state.draft().hours <= 22); }
  extrasCount(id: string): number { return this.state.draft().extras[id] || 0; }
  changeExtra(id: string, by: number): void { this.state.setExtra(id, this.extrasCount(id) + by); }
  openDrinkPicker(): void {
    this.router.navigate(['/booking/drinks'], {
      queryParams: { returnTo: '/booking/focus-pod?bookingStep=addons' },
    });
  }
  beginBooking(): void {
    if (this.checkingSession || this.checkingAvailability) return;
    if (!this.state.isSlotValid) {
      this.feedback = 'Chọn ngày giờ hợp lệ trong khung 08:00–22:00.';
      return;
    }

    this.verifyAvailability(() => this.requireSession());
  }
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

  private restoreAddonsStep(): void {
    this.auth.ensureSession().subscribe({
      next: user => user ? this.verifyAvailability(() => this.showAddons = true) : this.goToLogin(),
      error: () => {
        this.feedback = 'Không thể kiểm tra phiên đăng nhập. Vui lòng thử lại.';
        this.changeDetector.markForCheck();
      },
    });
  }

  private goToLogin(): void {
    const returnUrl = `${this.router.url.split('?')[0]}?bookingStep=addons`;
    this.router.navigate(['/login'], { queryParams: { returnUrl } });
  }

  private requireSession(): void {
    this.checkingSession = true;
    this.auth.ensureSession().subscribe({
      next: user => {
        this.checkingSession = false;
        if (user) {
          this.showAddons = true;
          this.feedback = '';
        } else {
          this.goToLogin();
        }
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.checkingSession = false;
        this.feedback = 'Không thể kiểm tra phiên đăng nhập. Vui lòng thử lại.';
        this.changeDetector.markForCheck();
      },
    });
  }

  private verifyAvailability(onAvailable: () => void): void {
    const draft = this.state.draft();
    this.checkingAvailability = true;
    this.availability.check(draft.date, draft.startHour, draft.guests, draft.hours).subscribe({
      next: spaces => {
        this.checkingAvailability = false;
        const selected = this.availability.forSpace('focus', spaces);
        if (!this.availability.packageAvailable(selected, draft.hours)) {
          this.showAddons = false;
          this.feedback = 'Gói này không còn chỗ trong khung giờ đã chọn. Hãy đổi lịch hoặc gói.';
          this.changeDetector.markForCheck();
          return;
        }
        onAvailable();
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.checkingAvailability = false;
        const message = error.error?.message ?? error.message;
        this.feedback = typeof message === 'string'
          ? message
          : 'Không thể kiểm tra lịch lúc này. Vui lòng thử lại.';
        this.changeDetector.markForCheck();
      },
    });
  }
}
