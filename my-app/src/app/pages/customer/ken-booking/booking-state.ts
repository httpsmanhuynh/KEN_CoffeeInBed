import { Injectable, effect, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth.service';

export type KenZone = 'focus' | 'rest';
export type KenDrinkCategory = 'coffee' | 'refreshment' | 'bakery';

export interface KenProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  category: KenDrinkCategory;
  description: string;
  detail?: string;
}

export interface KenSpaceRate {
  hours: number;
  price: number;
}

export interface KenBookingSpace {
  id: string;
  name: string;
  image: string;
  description: string;
  capacity: string;
  minGuests: number;
  maxGuests: number;
  perPerson: boolean;
  rates: KenSpaceRate[];
}

export const KEN_BOOKING_SPACES: KenBookingSpace[] = [
  {
    id: 'focus', name: 'Ô tập trung cá nhân', image: 'listing-focus.png',
    description: 'Một góc riêng tư, yên tĩnh cho học tập và làm việc tập trung.',
    capacity: '01 khách', minGuests: 1, maxGuests: 1, perPerson: false,
    rates: [{ hours: 1, price: 45000 }, { hours: 4, price: 140000 }]
  },
  {
    id: 'work', name: 'Khu làm việc chung', image: 'listing-work.png',
    description: 'Không gian làm việc linh hoạt, phù hợp làm việc cá nhân hoặc theo nhóm.',
    capacity: '1–20 khách', minGuests: 1, maxGuests: 20, perPerson: true,
    rates: [{ hours: 1, price: 30000 }, { hours: 4, price: 90000 }, { hours: 14, price: 150000 }]
  },
  {
    id: 'meeting-small', name: 'Phòng họp nhỏ', image: 'listing-meeting-small.png',
    description: 'Phòng họp riêng cho nhóm nhỏ, trang bị Wi-Fi, máy chiếu và bảng từ.',
    capacity: '3–6 khách', minGuests: 3, maxGuests: 6, perPerson: false,
    rates: [{ hours: 3, price: 250000 }]
  },
  {
    id: 'meeting-large', name: 'Phòng họp lớn', image: 'listing-meeting-large.png',
    description: 'Không gian họp riêng cho nhóm đông, trang bị máy chiếu và bảng từ.',
    capacity: '6–12 khách', minGuests: 6, maxGuests: 12, perPerson: false,
    rates: [{ hours: 3, price: 450000 }]
  },
  {
    id: 'single', name: 'KÉN nghỉ đơn', image: 'listing-single.png',
    description: 'Khoảng nghỉ riêng tư dành cho một người, có rèm che và đèn đọc sách.',
    capacity: '01 khách', minGuests: 1, maxGuests: 1, perPerson: false,
    rates: [{ hours: 1, price: 70000 }, { hours: 2, price: 130000 }, { hours: 4, price: 220000 }]
  },
  {
    id: 'double', name: 'KÉN nghỉ đôi', image: 'listing-double.png',
    description: 'Không gian nghỉ ngơi riêng dành cho tối đa hai khách.',
    capacity: '1–2 khách', minGuests: 1, maxGuests: 2, perPerson: false,
    rates: [{ hours: 1, price: 100000 }, { hours: 2, price: 180000 }, { hours: 4, price: 310000 }]
  },
  {
    id: 'private', name: 'Phòng riêng tư', image: 'listing-private.png',
    description: 'Phòng riêng có bàn ghế, phù hợp cho nhóm từ hai đến bốn khách.',
    capacity: '2–4 khách', minGuests: 2, maxGuests: 4, perPerson: false,
    rates: [{ hours: 1, price: 150000 }, { hours: 2, price: 280000 }, { hours: 4, price: 480000 }]
  }
];

export function kenBookingSpace(id: string): KenBookingSpace {
  return KEN_BOOKING_SPACES.find(space => space.id === id) || KEN_BOOKING_SPACES[0];
}

export const KEN_MENU: KenProduct[] = [
  { id: 'coffee', name: 'Cà phê Đen / Sữa', price: 40000, image: 'coffee.png', category: 'coffee', description: 'Đá / Nóng' },
  { id: 'americano', name: 'Americano', price: 40000, image: 'americano.png', category: 'coffee', description: 'Một lựa chọn cà phê quen thuộc' },
  { id: 'bac-xiu', name: 'Bạc Xỉu / Salted Caramel Coffee', price: 45000, image: 'bac-xiu.png', category: 'coffee', description: 'Hai hương vị, hai cách tận hưởng' },
  { id: 'cold-brew', name: 'Cold Brew Truyền thống / Trái cây', price: 50000, image: 'cold-brew.png', category: 'coffee', description: 'Chọn vị truyền thống hoặc trái cây' },
  { id: 'oolong', name: 'Trà Oolong Macchiato / Trà Đào', price: 50000, image: 'oolong.png', category: 'coffee', description: 'Chọn oolong macchiato hoặc trà đào' },
  { id: 'matcha', name: 'Matcha Latte / Hojicha Latte', price: 55000, image: 'matcha.png', category: 'coffee', description: 'Chọn matcha hoặc hojicha' },
  { id: 'water', name: 'Nước tinh khiết (chai)', price: 15000, image: 'water.png', category: 'refreshment', description: 'Cho những cuộc trò chuyện dài' },
  { id: 'juice', name: 'Nước cam / Nước ép chanh dây', price: 45000, image: 'juice.png', category: 'refreshment', description: 'Chọn cam hoặc chanh dây' },
  { id: 'soda', name: 'Soda trái cây', price: 45000, image: 'soda.png', category: 'refreshment', description: 'Một chút sắc màu cho buổi hẹn' },
  { id: 'croissant', name: 'Bánh sừng bò (Croissant) cơ bản', price: 35000, image: 'croissant.png', category: 'bakery', description: 'Một chiếc bánh cho buổi cà phê' },
  { id: 'mousse', name: 'Bánh Mousse', price: 45000, image: 'mousse.png', category: 'bakery', description: 'Trà xanh / Chanh dây' },
  { id: 'tiramisu', name: 'Tiramisu / Cheesecake', price: 50000, image: 'tiramisu.png', category: 'bakery', description: 'Chọn tiramisu hoặc cheesecake' },
  { id: 'bread', name: 'Bánh mì que', price: 30000, image: 'bread.png', category: 'bakery', description: 'Gọn nhẹ cho một khoảng nghỉ' },
  { id: 'sandwich', name: 'Sandwich', price: 45000, image: 'sandwich.png', category: 'bakery', description: 'Ăn nhẹ, rồi thong thả chuyện trò' },
  { id: 'fruit', name: 'Trái cây cắt sẵn', price: 40000, image: 'fruit.png', category: 'bakery', description: 'Thêm chút tươi mới cho ngày' }
];

export interface KenExtra {
  id: string;
  title: string;
  price: number;
  image: string;
  category: 'drink' | 'food' | 'equipment';
}

export const KEN_EXTRAS: KenExtra[] = [
  { id: 'extra-coffee', title: 'Cà phê Đen/Sữa', price: 40000, image: 'coffee.png', category: 'drink' },
  { id: 'extra-americano', title: 'Americano', price: 40000, image: 'americano.png', category: 'drink' },
  { id: 'extra-matcha', title: 'Matcha Latte', price: 55000, image: 'matcha.png', category: 'drink' },
  { id: 'extra-water', title: 'Nước suối', price: 15000, image: 'water.png', category: 'drink' },
  { id: 'extra-juice', title: 'Nước cam', price: 45000, image: 'juice.png', category: 'drink' },
  { id: 'extra-croissant', title: 'Bánh sừng bò (Croissant)', price: 35000, image: 'croissant.png', category: 'food' },
  { id: 'extra-mousse', title: 'Bánh Mousse', price: 45000, image: 'mousse.png', category: 'food' },
  { id: 'extra-sandwich', title: 'Sandwich', price: 45000, image: 'sandwich.png', category: 'food' },
  { id: 'extra-fruit', title: 'Trái cây cắt sẵn', price: 40000, image: 'fruit.png', category: 'food' },
  { id: 'extra-monitor', title: 'Màn hình 24”', price: 50000, image: 'monitor.png', category: 'equipment' },
  { id: 'extra-keyboard', title: 'Bàn phím & chuột', price: 30000, image: 'keyboard.png', category: 'equipment' },
  { id: 'extra-phone', title: 'Cáp & sạc dự phòng', price: 20000, image: 'powerbank.png', category: 'equipment' },
  { id: 'extra-stationery', title: 'Bộ bút & bảng', price: 15000, image: 'stationery.png', category: 'equipment' },
  { id: 'extra-printer', title: 'In tài liệu', price: 20000, image: 'printer.png', category: 'equipment' }
];

export interface KenBookingDraft {
  spaceId: string;
  date: string;
  startHour: number;
  hours: number;
  guests: number;
  drinkId: string | null;
  drinkQuantities: Record<string, number>;
  extras: Record<string, number>;
  fullName: string;
  phone: string;
  email: string;
  note: string;
  voucher: string;
  agreed: boolean;
  holdUntil: number | null;
  createdBookingId?: string | null;
  createdBookingCode?: string | null;
  paymentStatus?: string | null;
  ownerUserId?: string | null;
}

export function kenMoney(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.max(0, value)) + 'đ';
}

export function kenNextDay(): string {
  const today = new Date();
  today.setDate(today.getDate() + 1);
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class KenBookingState {
  private readonly auth = inject(AuthService, { optional: true });
  private readonly storageKey = 'ken-figma-booking-demo-v1';
  readonly draft = signal<KenBookingDraft>(this.load());
  readonly drinks = KEN_MENU.filter(item => item.category !== 'bakery');
  readonly extras = KEN_EXTRAS;

  constructor() {
    if (this.auth) {
      effect(() => {
        const uid = this.auth!.user?.id ?? null;
        const currentOwner = this.draft().ownerUserId ?? null;
        if (uid && currentOwner && uid !== currentOwner) {
          this.resetForUser(uid);
        } else if (uid && !currentOwner) {
          this.draft.set({ ...this.draft(), ownerUserId: uid });
        }
      });
    }
  }

  private resetForUser(ownerUserId: string | null): void {
    const clean = { ...this.defaults(), ownerUserId };
    this.draft.set(clean);
    try { localStorage.setItem(this.storageKey, JSON.stringify(clean)); } catch {}
  }

  private defaults(): KenBookingDraft {
    return {
      spaceId: 'focus', date: kenNextDay(), startHour: 9, hours: 4, guests: 1,
      drinkId: 'matcha', drinkQuantities: {}, extras: {}, fullName: '', phone: '', email: '', note: '',
      voucher: '', agreed: false, holdUntil: null
    };
  }

  private load(): KenBookingDraft {
    const empty = this.defaults();
    try {
      const text = typeof localStorage === 'undefined' ? null : localStorage.getItem(this.storageKey);
      if (!text) return empty;
      const obj = JSON.parse(text) as Partial<KenBookingDraft>;
      if (!obj || typeof obj !== 'object') return empty;
      const state = {
        ...empty, ...obj,
        drinkQuantities: { ...empty.drinkQuantities, ...(obj.drinkQuantities || {}) },
        extras: { ...empty.extras, ...(obj.extras || {}) }
      };
      const space = kenBookingSpace(state.spaceId);
      state.spaceId = space.id;
      const isHourlySpace = space.id === 'work' || space.id === 'focus';
      if (!space.rates.some(rate => rate.hours === state.hours) && !(isHourlySpace && state.hours >= 1 && state.hours <= 14)) {
        state.hours = space.rates[0].hours;
      }
      if (!/^\d{4}-\d\d-\d\d$/.test(state.date) || state.date < new Date().toLocaleDateString('en-CA')) state.date = kenNextDay();
      if (!Number.isInteger(state.startHour) || state.startHour < 8 || state.startHour + state.hours > 22) state.startHour = 9;
      state.guests = Math.max(space.minGuests, Math.min(space.maxGuests, Number(state.guests) || space.minGuests));
      return state;
    } catch {
      return empty;
    }
  }

  set(change: Partial<KenBookingDraft>): void {
    const previous = this.draft();
    const next = { ...previous, ...change };
    if (change.spaceId !== undefined && change.spaceId !== previous.spaceId) {
      const space = kenBookingSpace(change.spaceId);
      if (change.hours === undefined) next.hours = space.rates[0].hours;
      if (change.guests === undefined) {
        next.guests = Math.max(space.minGuests, Math.min(space.maxGuests, previous.guests));
      }
      next.drinkId = null;
      next.drinkQuantities = {};
      next.extras = {};
    } else if (change.guests !== undefined && change.guests !== previous.guests && change.drinkQuantities === undefined) {
      next.drinkId = null;
      next.drinkQuantities = {};
    }

    // Huy thoi han giu cho cu neu noi dung dat cho thay doi.
    const selectionChanged =
      (change.date !== undefined && change.date !== previous.date) ||
      (change.startHour !== undefined && change.startHour !== previous.startHour) ||
      (change.hours !== undefined && change.hours !== previous.hours) ||
      (change.spaceId !== undefined && change.spaceId !== previous.spaceId) ||
      (change.guests !== undefined && change.guests !== previous.guests) ||
      (change.drinkId !== undefined && change.drinkId !== previous.drinkId) ||
      (change.drinkQuantities !== undefined &&
       JSON.stringify(change.drinkQuantities) !== JSON.stringify(previous.drinkQuantities)) ||
      (change.extras !== undefined &&
       JSON.stringify(change.extras) !== JSON.stringify(previous.extras)) ||
      (change.voucher !== undefined && change.voucher !== previous.voucher);

    if (selectionChanged) {
      next.holdUntil = null;
      next.createdBookingId = null;
      next.createdBookingCode = null;
      next.paymentStatus = null;
    }
    if (next.startHour + next.hours > 22) next.startHour = 22 - next.hours;
    this.draft.set(next);
    try { localStorage.setItem(this.storageKey, JSON.stringify(next)); } catch { /* non-persistent preview */ }
  }

  setExtra(id: string, count: number): void {
    if (!this.extras.some(item => item.id === id)) return;
    const extras = { ...this.draft().extras, [id]: Math.max(0, Math.min(9, count)) };
    this.set({ extras });
  }

  setDrinkQuantity(id: string, count: number): void {
    if (!this.drinks.some(item => item.id === id)) return;
    const drinkQuantities = { ...this.draft().drinkQuantities };
    const quantityLimit = this.requiredDrinkCount || 9;
    const quantity = Math.max(0, Math.min(quantityLimit, count));
    if (quantity === 0) delete drinkQuantities[id];
    else drinkQuantities[id] = quantity;
    const drinkId = Object.keys(drinkQuantities).find(key => drinkQuantities[key] > 0) || null;
    this.set({ drinkId, drinkQuantities });
  }

  get space(): KenBookingSpace { return kenBookingSpace(this.draft().spaceId); }
  getSpace(id: string): KenBookingSpace | undefined {
    return KEN_BOOKING_SPACES.find(space => space.id === id);
  }
  get isFocusSpace(): boolean { return this.draft().spaceId === 'focus'; }
  get requiredDrinkCount(): number {
    if (this.isFocusSpace) return this.draft().hours === 4 ? 1 : 0;
    return this.draft().guests;
  }
  get selectedDrinkCount(): number {
    const quantities = this.draft().drinkQuantities;
    return Object.keys(quantities).length
      ? Object.values(quantities).reduce((total, count) => total + count, 0)
      : (this.draft().drinkId ? 1 : 0);
  }
  drinkQuantity(id: string): number {
    const quantities = this.draft().drinkQuantities;
    return quantities[id] ?? (this.draft().drinkId === id ? 1 : 0);
  }
  get selectedDrinks(): Array<{ product: KenProduct; quantity: number }> {
    return this.drinks
      .map(product => ({ product, quantity: this.drinkQuantity(product.id) }))
      .filter(item => item.quantity > 0);
  }

  get selectedDrink(): KenProduct | undefined {
    return this.drinks.find(d => d.id === this.draft().drinkId) || this.selectedDrinks[0]?.product;
  }

  get base(): number {
    const fixedRate = this.space.rates.find(item => item.hours === this.draft().hours)?.price;
    const price = fixedRate !== undefined
      ? fixedRate
      : (this.space.id === 'work' || this.space.id === 'focus')
        ? this.space.rates[0].price * this.draft().hours
        : 0;
    return price * (this.space.perPerson ? this.draft().guests : 1);
  }
  get entitlement(): number {
    return this.isFocusSpace && this.draft().hours !== 4 ? 0 : 50000;
  }
  get drinkSurcharge(): number {
    return this.selectedDrinks.reduce(
      (total, item) => total + item.quantity * Math.max(0, item.product.price - this.entitlement),
      0
    );
  }
  get extrasTotal(): number {
    return this.extras.reduce((sum, product) => sum + product.price * (this.draft().extras[product.id] || 0), 0);
  }
  get subtotal(): number { return this.base + this.drinkSurcharge + this.extrasTotal; }
  get silverDiscount(): number { return Math.round(this.subtotal * 0.05); }
  get total(): number { return this.subtotal - this.silverDiscount; }
  get endHour(): number { return this.draft().startHour + this.draft().hours; }
  get dateLabel(): string {
    return new Date(this.draft().date + 'T12:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  get timeLabel(): string { return `${String(this.draft().startHour).padStart(2, '0')}:00–${String(this.endHour).padStart(2, '0')}:00`; }
  get isSlotValid(): boolean {
    const d = this.draft();
    const when = new Date(`${d.date}T${String(d.startHour).padStart(2, '0')}:00:00`).getTime();
    return Number.isFinite(when) && when - Date.now() >= 30 * 60 * 1000 && d.startHour + d.hours <= 22;
  }
  startDemoHold(): void {
    // Khong khoi dong lai dong ho neu luot giu cho van con han.
    const currentHold = this.draft().holdUntil;

    if (currentHold && currentHold > Date.now()) {
      return;
    }

    this.set({ holdUntil: Date.now() + 15 * 60 * 1000 });
  }
  get holdRemainingSeconds(): number { return Math.max(0, Math.ceil(((this.draft().holdUntil || 0) - Date.now()) / 1000)); }
  money = kenMoney;
  image(file: string): string { return '/images/ken-flow/' + file; }
}
