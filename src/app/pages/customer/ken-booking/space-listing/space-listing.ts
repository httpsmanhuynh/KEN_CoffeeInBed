import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { KenBookingState, kenNextDay } from '../booking-state';

interface KenListingSpace {
  id: string;
  name: string;
  image: string;
  zone: 'focus' | 'rest';
  occupancy: string;
  rate: string;
  badge: string;
  features: string[];
  url?: string;
  canBook: boolean;
}

@Component({ selector: 'app-ken-space-listing', standalone: false, templateUrl: './space-listing.html', styleUrl: './space-listing.css' })
export class KenSpaceListingPage {
  scrollToFilters(): void {
    if (typeof document === 'undefined' ||
        typeof window === 'undefined') {
      return;
    }

    const target = document.getElementById('ken-space-filters');

    if (!target) {
      return;
    }

    const top =
      target.getBoundingClientRect().top +
      window.scrollY - 96;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: 'smooth'
    });
  }

  zone: 'all' | 'focus' | 'rest' = 'all';
  feedback = '';
  readonly guestOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  readonly hours = Array.from({ length: 14 }, (_, i) => i + 8);
  readonly cards: KenListingSpace[] = [
    { id: 'work', name: 'Khu làm việc chung', image: 'listing-work.png', zone: 'focus', occupancy: '1–20 khách · Dùng chung', rate: '30.000đ / người/giờ', badge: 'Mẫu: còn 14/20 chỗ', features: ['Wi-Fi', 'Ổ cắm', 'Linh hoạt'], url: '/spaces/work-lounge', canBook: false },
    { id: 'focus', name: 'Ô tập trung cá nhân', image: 'listing-focus.png', zone: 'focus', occupancy: '1 khách · Dùng riêng', rate: '45.000đ / giờ', badge: 'Mẫu: còn chỗ', features: ['Wi-Fi', 'Ổ cắm', 'Riêng tư'], url: '/booking/focus-pod', canBook: true },
    { id: 'meeting-small', name: 'Phòng họp nhỏ', image: 'listing-meeting-small.png', zone: 'focus', occupancy: '3–6 khách · Máy chiếu + bảng từ', rate: '250.000đ / gói 3 giờ', badge: 'Tối thiểu 3 khách', features: ['Wi-Fi', 'Máy chiếu', '3 giờ'], url: '/spaces/small-meeting-room', canBook: false },
    { id: 'meeting-large', name: 'Phòng họp lớn', image: 'listing-meeting-large.png', zone: 'focus', occupancy: '6–12 khách · Máy chiếu + bảng từ', rate: '450.000đ / gói 3 giờ', badge: 'Tối thiểu 6 khách', features: ['Wi-Fi', 'Máy chiếu', '3 giờ'], canBook: false },
    { id: 'single', name: 'KÉN nghỉ đơn', image: 'listing-single.png', zone: 'rest', occupancy: '1 người · Rèm che · Đèn đọc sách', rate: 'Từ 70.000đ', badge: 'Mẫu: còn trống', features: ['1h · 70K', '2h · 130K', '4h · 220K'], canBook: false },
    { id: 'double', name: 'KÉN nghỉ đôi', image: 'listing-double.png', zone: 'rest', occupancy: '1–2 người · Rèm che · Đèn đọc sách', rate: 'Từ 100.000đ', badge: 'Mẫu: còn trống', features: ['1h · 100K', '2h · 180K', '4h · 310K'], canBook: false },
    { id: 'private', name: 'Phòng riêng tư', image: 'listing-private.png', zone: 'rest', occupancy: '2–4 người · Bàn + ghế', rate: 'Từ 150.000đ', badge: 'Tối thiểu 2 khách', features: ['1h · 150K', '2h · 280K', '4h · 480K'], canBook: false }
  ];
  constructor(public state: KenBookingState, private router: Router) {}
  get focusCards(): KenListingSpace[] { return this.zone === 'rest' ? [] : this.cards.filter(x => x.zone === 'focus'); }
  get restCards(): KenListingSpace[] { return this.zone === 'focus' ? [] : this.cards.filter(x => x.zone === 'rest'); }
  setDate(value: string): void { this.state.set({ date: value }); this.feedback = ''; }
  setHour(value: string): void { this.state.set({ startHour: Number(value) }); this.feedback = ''; }
  choose(space: KenListingSpace): void {
    if (!space.canBook) {
      this.feedback = 'Luồng đặt chỗ của không gian này chưa được xây dựng trong 6 màn hình được chọn. Bạn có thể xem chi tiết nếu trang đã có.';
      return;
    }
    this.state.set({ guests: 1, holdUntil: null });
    this.router.navigateByUrl('/booking/focus-pod');
  }
  open(space: KenListingSpace): void {
    if (space.id === 'focus') {
      this.router.navigateByUrl('/spaces/focus-pod');
      return;
    }
    if (space.url) this.router.navigateByUrl(space.url);
    else this.feedback = `Trang chi tiết “${space.name}” chưa được tích hợp.`;
  }
  get minDate(): string { return kenNextDay(); }
}
