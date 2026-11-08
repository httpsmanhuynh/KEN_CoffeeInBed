import { Injectable, signal } from '@angular/core';

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
  date: string;
  startHour: number;
  hours: 1 | 4;
  guests: number;
  drinkId: string | null;
  extras: Record<string, number>;
  fullName: string;
  phone: string;
  email: string;
  note: string;
  voucher: string;
  agreed: boolean;
  holdUntil: number | null;
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
  private readonly storageKey = 'ken-figma-booking-demo-v1';
  readonly draft = signal<KenBookingDraft>(this.load());
  readonly drinks = KEN_MENU.filter(item => item.category !== 'bakery');
  readonly extras = KEN_EXTRAS;

  private defaults(): KenBookingDraft {
    return {
      date: kenNextDay(), startHour: 9, hours: 4, guests: 1,
      drinkId: 'matcha', extras: {}, fullName: '', phone: '', email: '', note: '',
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
      const state = { ...empty, ...obj, extras: { ...empty.extras, ...(obj.extras || {}) } };
      if (!/^\d{4}-\d\d-\d\d$/.test(state.date) || state.date < new Date().toLocaleDateString('en-CA')) state.date = kenNextDay();
      if (state.hours !== 1 && state.hours !== 4) state.hours = 4;
      if (!Number.isInteger(state.startHour) || state.startHour < 8 || state.startHour + state.hours > 22) state.startHour = 9;
      state.guests = 1; // Focus Pod: chỉ cho một khách
      return state;
    } catch {
      return empty;
    }
  }

  set(change: Partial<KenBookingDraft>): void {
    const previous = this.draft();
    const next = { ...previous, ...change };

    // Huy thoi han giu cho cu neu noi dung dat cho thay doi.
    const selectionChanged =
      (change.date !== undefined && change.date !== previous.date) ||
      (change.startHour !== undefined && change.startHour !== previous.startHour) ||
      (change.hours !== undefined && change.hours !== previous.hours) ||
      (change.guests !== undefined && change.guests !== previous.guests) ||
      (change.drinkId !== undefined && change.drinkId !== previous.drinkId) ||
      (change.extras !== undefined &&
       JSON.stringify(change.extras) !== JSON.stringify(previous.extras));

    if (selectionChanged) {
      next.holdUntil = null;
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

  get selectedDrink(): KenProduct | undefined {
    return this.drinks.find(d => d.id === this.draft().drinkId);
  }

  get base(): number { return this.draft().hours === 4 ? 140000 : 45000; }
  get entitlement(): number { return this.draft().hours === 4 ? 50000 : 0; }
  get drinkSurcharge(): number {
    return this.selectedDrink ? (this.entitlement ? Math.max(0, this.selectedDrink.price - this.entitlement) : this.selectedDrink.price) : 0;
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
