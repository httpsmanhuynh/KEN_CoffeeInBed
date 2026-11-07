import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { KenBookingState, KEN_MENU, kenMoney, kenNextDay } from './booking-state';
import type { KenBookingDraft, KenDrinkCategory, KenProduct } from './booking-state';

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

@Component({
  selector: 'app-ken-booking-shell', standalone: false,
  template: '<app-header [isLoggedIn]="true" userName="Khách hàng"></app-header><router-outlet></router-outlet><app-footer></app-footer>'
})
export class KenBookingShell {}

@Component({ selector: 'app-ken-cafe-catalog', standalone: false, templateUrl: './cafe-catalog.html' })
export class KenCafeCatalogPage {
  readonly products = KEN_MENU;
  category: 'all' | KenDrinkCategory = 'all';
  searchText = '';
  priceFilter: 'all' | 'under50' | 'from50' = 'all';
  sorting: 'group' | 'price-asc' | 'price-desc' = 'group';
  money = kenMoney;
  readonly categories: { id: 'all' | KenDrinkCategory; label: string }[] = [
    { id: 'all', label: 'Tất cả' }, { id: 'coffee', label: 'Cà phê & trà' },
    { id: 'refreshment', label: 'Giải khát' }, { id: 'bakery', label: 'Bánh & ăn nhẹ' }
  ];
  readonly sections = [
    { id: 'coffee' as KenDrinkCategory, no: '01', title: 'Cà phê & trà', subtitle: 'Một ly quen, hay một hương vị mới?' },
    { id: 'refreshment' as KenDrinkCategory, no: '02', title: 'Một chút tươi mát', subtitle: 'Nước uống & trái cây, cho buổi hẹn thêm vui.' },
    { id: 'bakery' as KenDrinkCategory, no: '03', title: 'Bánh & ăn nhẹ', subtitle: 'Nhâm nhi cùng cà phê, hoặc lót dạ một chút.' }
  ];
  get shownSections() {
    return this.sections.filter(s => this.category === 'all' || this.category === s.id).filter(s => this.forSection(s.id).length > 0);
  }
  forSection(category: KenDrinkCategory): KenProduct[] {
    const words = this.searchText.toLocaleLowerCase('vi-VN').trim();
    let items = this.products.filter(p => p.category === category && p.name.toLocaleLowerCase('vi-VN').includes(words));
    items = items.filter(p => this.priceFilter === 'all' || (this.priceFilter === 'under50' ? p.price < 50000 : p.price >= 50000));
    if (this.sorting !== 'group') items = [...items].sort((a, b) => this.sorting === 'price-asc' ? a.price - b.price : b.price - a.price);
    return items;
  }
  get resultCount(): number { return this.sections.reduce((n, s) => n + this.forSection(s.id).length, 0); }
  image = (p: KenProduct) => '/images/ken-flow/' + p.image;
}

@Component({ selector: 'app-ken-space-listing', standalone: false, templateUrl: './space-listing.html' })
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

@Component({ selector: 'app-ken-focus-booking', standalone: false, templateUrl: './focus-pod.html' })
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

@Component({ selector: 'app-ken-drink-picker', standalone: false, templateUrl: './drink-picker.html' })
export class KenDrinkPickerPage {
  searchText = '';
  category: 'all' | 'coffee' | 'refreshment' = 'all';
  extraOnly = false;
  sorting: 'default' | 'price-asc' | 'price-desc' = 'default';
  readonly money = kenMoney;
  constructor(public state: KenBookingState, private router: Router) {}
  get filteredDrinks() {
    let arr = this.state.drinks.filter(d =>
      (this.category === 'all' || d.category === this.category) &&
      (!this.extraOnly || d.price > this.state.entitlement) &&
      d.name.toLocaleLowerCase('vi-VN').includes(this.searchText.trim().toLocaleLowerCase('vi-VN'))
    );
    if (this.sorting !== 'default') arr = [...arr].sort((a, b) => this.sorting === 'price-asc' ? a.price - b.price : b.price - a.price);
    return arr;
  }
  get coffee() { return this.filteredDrinks.filter(d => d.category === 'coffee'); }
  get refreshments() { return this.filteredDrinks.filter(d => d.category === 'refreshment'); }
  select(id: string): void { this.state.set({ drinkId: id }); }
  back(): void { this.router.navigateByUrl('/booking/focus-pod'); }
}

@Component({ selector: 'app-ken-booking-review', standalone: false, templateUrl: './booking-review.html' })
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

@Component({ selector: 'app-ken-booking-payment', standalone: false, templateUrl: './booking-payment.html' })
export class KenBookingPaymentPage implements OnInit, OnDestroy {
  now = Date.now();
  private timer?: ReturnType<typeof setInterval>;
  readonly money = kenMoney;
  constructor(public state: KenBookingState, private router: Router) {}
  ngOnInit(): void { this.timer = setInterval(() => this.now = Date.now(), 1000); }
  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }
  get remaining(): number { return Math.max(0, Math.ceil(((this.state.draft().holdUntil || 0) - this.now) / 1000)); }
  get countdown(): string { const r = this.remaining; return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`; }
  get demoExpired(): boolean { return this.remaining === 0; }
  back(): void { this.router.navigateByUrl('/booking/review'); }
}
