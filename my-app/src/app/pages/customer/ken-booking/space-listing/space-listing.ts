import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component } from '@angular/core';
import { Router } from '@angular/router';
import { KenBookingState, kenNextDay } from '../booking-state';
import { KenAvailabilityService, KenAvailabilitySpace } from '../availability.service';

interface KenListingSpace {
  id: string;
  name: string;
  image: string;
  zone: 'focus' | 'rest';
  occupancy: string;
  rate: string;
  features: string[];
}

@Component({
  selector: 'app-ken-space-listing',
  standalone: false,
  templateUrl: './space-listing.html',
  styleUrl: './space-listing.css',
})
export class KenSpaceListingPage {
  zone: 'all' | 'focus' | 'rest' = 'all';
  availabilityFilter: 'all' | 'available' = 'all';
  searchText = '';
  selectedSpaceId: string | null = null;
  availabilityState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  availabilityMessage = '';
  private readonly availabilityBySpace = new Map<string, KenAvailabilitySpace>();

  readonly guestOptions = Array.from({ length: 20 }, (_, i) => i + 1);
  readonly hours = Array.from({ length: 14 }, (_, i) => i + 8);
  readonly cards: KenListingSpace[] = [
    { id: 'work', name: 'Khu làm việc chung', image: 'listing-work.png', zone: 'focus', occupancy: '1–20 khách · Dùng chung', rate: '30.000đ / người/giờ', features: ['Wi-Fi', 'Ổ cắm', 'Linh hoạt'] },
    { id: 'focus', name: 'Ô tập trung cá nhân', image: 'listing-focus.png', zone: 'focus', occupancy: '1 khách · Dùng riêng', rate: '45.000đ / giờ', features: ['Wi-Fi', 'Ổ cắm', 'Riêng tư'] },
    { id: 'meeting-small', name: 'Phòng họp nhỏ', image: 'listing-meeting-small.png', zone: 'focus', occupancy: '3–6 khách · Máy chiếu + bảng từ', rate: '250.000đ / gói 3 giờ', features: ['Wi-Fi', 'Máy chiếu', '3 giờ'] },
    { id: 'meeting-large', name: 'Phòng họp lớn', image: 'listing-meeting-large.png', zone: 'focus', occupancy: '6–12 khách · Máy chiếu + bảng từ', rate: '450.000đ / gói 3 giờ', features: ['Wi-Fi', 'Máy chiếu', '3 giờ'] },
    { id: 'single', name: 'KÉN nghỉ đơn', image: 'listing-single.png', zone: 'rest', occupancy: '1 người · Rèm che · Đèn đọc sách', rate: 'Từ 70.000đ', features: ['1h · 70K', '2h · 130K', '4h · 220K'] },
    { id: 'double', name: 'KÉN nghỉ đôi', image: 'listing-double.png', zone: 'rest', occupancy: '1–2 người · Rèm che · Đèn đọc sách', rate: 'Từ 100.000đ', features: ['1h · 100K', '2h · 180K', '4h · 310K'] },
    { id: 'private', name: 'Phòng riêng tư', image: 'listing-private.png', zone: 'rest', occupancy: '2–4 người · Bàn + ghế', rate: 'Từ 150.000đ', features: ['1h · 150K', '2h · 280K', '4h · 480K'] },
  ];

  constructor(
    public state: KenBookingState,
    private router: Router,
    private availability: KenAvailabilityService,
    private changeDetector: ChangeDetectorRef,
  ) {}

  get focusCards(): KenListingSpace[] {
    return this.filteredCards.filter(space => space.zone === 'focus');
  }

  get restCards(): KenListingSpace[] {
    return this.filteredCards.filter(space => space.zone === 'rest');
  }

  private get filteredCards(): KenListingSpace[] {
    const query = this.searchText.trim().toLocaleLowerCase('vi-VN');
    return this.cards.filter(space => {
      const zoneMatches = this.zone === 'all' || this.zone === space.zone;
      const guestMatches = this.fitsGuests(space);
      const textMatches = !query ||
        `${space.name} ${space.occupancy} ${space.features.join(' ')}`
          .toLocaleLowerCase('vi-VN')
          .includes(query);
      const availabilityMatches =
        this.availabilityFilter === 'all' || this.isAvailable(space);
      return zoneMatches && guestMatches && textMatches && availabilityMatches;
    });
  }

  setDate(value: string): void {
    this.state.set({ date: value });
    this.resetAvailability();
  }

  setHour(value: string): void {
    this.state.set({ startHour: Number(value) });
    this.resetAvailability();
  }

  setGuests(value: string): void {
    this.state.set({ guests: Number(value) });
    this.resetAvailability();
  }

  checkAvailability(): void {
    if (this.availabilityState === 'loading') return;

    const draft = this.state.draft();
    this.availabilityState = 'loading';
    this.availabilityMessage = '';
    this.selectedSpaceId = null;
    this.availability.check(draft.date, draft.startHour, draft.guests, 1).subscribe({
      next: spaces => {
        this.availabilityBySpace.clear();
        for (const space of spaces) {
          const card = this.cards.find(item => this.availability.forSpace(item.id, [space]));
          if (card) this.availabilityBySpace.set(card.id, space);
        }
        this.availabilityState = 'ready';
        this.availabilityMessage = spaces.length === 0
          ? 'Chưa có không gian đang hoạt động trong danh mục để kiểm tra lịch.'
          : this.availabilityBySpace.size === 0
            ? 'Chưa thể đối chiếu lịch trống với danh sách không gian này.'
            : '';
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.availabilityState = 'error';
        const message = error.error?.message ?? error.message;
        this.availabilityMessage = typeof message === 'string'
          ? message
          : 'Không thể kiểm tra lịch lúc này. Vui lòng thử lại.';
        this.changeDetector.markForCheck();
      },
    });
  }

  availabilityLabel(space: KenListingSpace): string {
    if (this.availabilityState === 'loading') return 'Đang kiểm tra…';
    if (this.availabilityState !== 'ready') return 'Chưa kiểm tra lịch';
    const result = this.availabilityBySpace.get(space.id);
    if (!result) return 'Chưa có dữ liệu';
    if (!result.isAvailable) return this.reasonLabel(result.availabilityReason);
    return result.remainingCapacity
      ? `Còn ${result.remainingCapacity} chỗ`
      : 'Còn chỗ';
  }

  canChoose(space: KenListingSpace): boolean {
    return this.availabilityState === 'ready' && this.isAvailable(space);
  }

  choose(space: KenListingSpace): void {
    if (!this.canChoose(space)) return;
    if (this.selectedSpaceId !== space.id) {
      this.selectedSpaceId = space.id;
      return;
    }

    this.state.set({ spaceId: space.id });
    this.router.navigateByUrl(space.id === 'focus' ? '/booking/focus-pod' : `/booking/${space.id}`);
  }

  open(space: KenListingSpace): void {
    const details: Record<string, string> = {
      focus: '/spaces/focus-pod',
      work: '/spaces/work-lounge',
      'meeting-small': '/spaces/small-meeting-room',
    };
    this.router.navigateByUrl(details[space.id] || '/spaces/booking/' + space.id);
  }

  get minDate(): string {
    return kenNextDay();
  }

  private fitsGuests(space: KenListingSpace): boolean {
    const config = this.state.getSpace(space.id);
    const guests = this.state.draft().guests;
    return !!config && guests >= config.minGuests && guests <= config.maxGuests;
  }

  private isAvailable(space: KenListingSpace): boolean {
    return this.availabilityBySpace.get(space.id)?.isAvailable === true;
  }

  private resetAvailability(): void {
    this.availabilityState = 'idle';
    this.availabilityMessage = '';
    this.availabilityBySpace.clear();
    this.selectedSpaceId = null;
  }

  private reasonLabel(reason?: string | null): string {
    switch (reason) {
      case 'OUTSIDE_OPERATING_HOURS': return 'Ngoài giờ hoạt động';
      case 'CAPACITY_EXCEEDED': return 'Không đủ sức chứa';
      case 'OVERLAP': return 'Đã kín khung giờ';
      default: return 'Không còn chỗ';
    }
  }
}
