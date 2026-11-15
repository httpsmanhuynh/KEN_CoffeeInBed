import { Injectable, effect, inject, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthService } from '../../../core/auth.service';
import { CustomerApiService } from '../../../core/customer-api.service';

export type KenZone = 'focus' | 'rest';
export type KenDrinkCategory = 'coffee' | 'refreshment' | 'bakery';

export interface KenProduct {
  id: string;
  apiProductId?: string;
  itemCode?: string;
  rawCategory?: string;
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
    rates: [{ hours: 1, price: 70000 }, { hours: 2, price: 130000 }, { hours: 4, price: 220000 }, { hours: 8, price: 350000 }]
  },
  {
    id: 'double', name: 'KÉN nghỉ đôi', image: 'listing-double.png',
    description: 'Không gian nghỉ ngơi riêng dành cho tối đa hai khách.',
    capacity: '1–2 khách', minGuests: 1, maxGuests: 2, perPerson: false,
    rates: [{ hours: 1, price: 100000 }, { hours: 2, price: 180000 }, { hours: 4, price: 310000 }, { hours: 8, price: 490000 }]
  },
  {
    id: 'private', name: 'Phòng riêng tư', image: 'listing-private.png',
    description: 'Phòng riêng có bàn ghế, phù hợp cho nhóm từ hai đến bốn khách.',
    capacity: '2–4 khách', minGuests: 2, maxGuests: 4, perPerson: false,
    rates: [{ hours: 1, price: 150000 }, { hours: 2, price: 290000 }, { hours: 4, price: 480000 }, { hours: 8, price: 770000 }]
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
  apiAddonId?: string;
  title: string;
  price: number;
  image: string;
  category: 'drink' | 'food' | 'equipment';
  unit?: 'PER_ITEM' | 'PER_BOOKING';
}

export const KEN_EXTRAS: KenExtra[] = [
  { id: 'extra-coffee', title: 'Cà phê Đen/Sữa', price: 40000, image: 'coffee.png', category: 'drink', unit: 'PER_ITEM' },
  { id: 'extra-americano', title: 'Americano', price: 40000, image: 'americano.png', category: 'drink', unit: 'PER_ITEM' },
  { id: 'extra-matcha', title: 'Matcha Latte', price: 55000, image: 'matcha.png', category: 'drink', unit: 'PER_ITEM' },
  { id: 'extra-water', title: 'Nước suối', price: 15000, image: 'water.png', category: 'drink', unit: 'PER_ITEM' },
  { id: 'extra-juice', title: 'Nước cam', price: 45000, image: 'juice.png', category: 'drink', unit: 'PER_ITEM' },
  { id: 'extra-croissant', title: 'Bánh sừng bò (Croissant)', price: 35000, image: 'croissant.png', category: 'food', unit: 'PER_ITEM' },
  { id: 'extra-mousse', title: 'Bánh Mousse', price: 45000, image: 'mousse.png', category: 'food', unit: 'PER_ITEM' },
  { id: 'extra-sandwich', title: 'Sandwich', price: 45000, image: 'sandwich.png', category: 'food', unit: 'PER_ITEM' },
  { id: 'extra-fruit', title: 'Trái cây cắt sẵn', price: 40000, image: 'fruit.png', category: 'food', unit: 'PER_ITEM' },
  { id: 'extra-monitor', title: 'Màn hình 24”', price: 50000, image: 'monitor.png', category: 'equipment', unit: 'PER_BOOKING' },
  { id: 'extra-keyboard', title: 'Bàn phím & chuột', price: 30000, image: 'keyboard.png', category: 'equipment', unit: 'PER_BOOKING' },
  { id: 'extra-phone', title: 'Cáp & sạc dự phòng', price: 20000, image: 'powerbank.png', category: 'equipment', unit: 'PER_BOOKING' },
  { id: 'extra-stationery', title: 'Bộ bút & bảng', price: 15000, image: 'stationery.png', category: 'equipment', unit: 'PER_BOOKING' },
  { id: 'extra-printer', title: 'In tài liệu', price: 20000, image: 'printer.png', category: 'equipment', unit: 'PER_ITEM' }
];

export interface KenBookingDraft {
  spaceId: string;
  date: string;
  startHour: number;
  hours: number;
  guests: number;
  drinkId: string | null;
  drinkQuantities: Record<string, number>;
  pastryQuantities: Record<string, number>;
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

function tryInjectAuth(): AuthService | null {
  try {
    return inject(AuthService, { optional: true });
  } catch {
    return null;
  }
}

function tryInjectCustomerApi(): CustomerApiService | null {
  try {
    return inject(CustomerApiService, { optional: true });
  } catch {
    return null;
  }
}

const CANONICAL_PRODUCT_SLUGS: Record<string, string> = {
  CF_DEN: 'coffee',
  CF_AMERICANO: 'americano',
  CF_BAC_XIU: 'bac-xiu',
  CF_COLD_BREW: 'cold-brew',
  TEA_OOLONG_MACCHIATO: 'oolong',
  MATCHA_LATTE: 'matcha',
  WATER_BOTTLE: 'water',
  JUICE_CAM: 'juice',
  SODA_TRAI_CAY: 'soda',
  BAKE_CROISSANT: 'croissant',
  MOUSSE_MATCHA: 'mousse',
  CAKE_TIRAMISU: 'tiramisu',
  BREAD_QUE: 'bread',
  SNACK_SANDWICH: 'sandwich',
  SNACK_FRUIT: 'fruit',
};

const CANONICAL_ADDON_SLUGS: Record<string, string> = {
  'cà phê đen': 'extra-coffee',
  americano: 'extra-americano',
  'matcha latte': 'extra-matcha',
  'nước tinh khiết': 'extra-water',
  'nước suối': 'extra-water',
  'nước cam': 'extra-juice',
  'croissant bơ': 'extra-croissant',
  'bánh sừng bò (croissant)': 'extra-croissant',
  'mousse trà xanh': 'extra-mousse',
  'bánh mousse': 'extra-mousse',
  sandwich: 'extra-sandwich',
  'trái cây cắt sẵn': 'extra-fruit',
  'thuê màn hình rời 24 inch': 'extra-monitor',
  'bàn phím và chuột rời': 'extra-keyboard',
  'cáp và sạc dự phòng': 'extra-phone',
  'bộ bút và bảng nhỏ': 'extra-stationery',
  'in tài liệu dưới 20 trang a4': 'extra-printer',
};

const SPACE_CODE_TO_LOCAL: Record<string, string> = {
  'FP-01': 'focus',
  'WL-01': 'work',
  'SMR-01': 'meeting-small',
  'BR-01': 'meeting-large',
  'SBP-01': 'single',
  'DBP-01': 'double',
  'PS-01': 'private',
};

function resolveProductImage(raw: any): string {
  const code = String(raw?.item_code || '').toUpperCase();
  const sub = String(raw?.sub_category || '').toUpperCase();
  const cat = String(raw?.category || '').toUpperCase();
  const name = String(raw?.name || raw?.title || '').toLocaleLowerCase('vi-VN');

  const url = typeof raw?.image_url === 'string' ? raw.image_url : '';
  if (url.startsWith('/images/ken-flow/') || url.startsWith('/images/figma/') || url.startsWith('http')) {
    return url;
  }

  if (code === 'CF_AMERICANO' || name.includes('americano')) return 'americano.png';
  if (code === 'CF_BAC_XIU' || code === 'CF_SALTED_CARAMEL' || name.includes('bạc xỉu') || name.includes('caramel')) return 'bac-xiu.png';
  if (code.includes('COLD_BREW') || name.includes('cold brew')) return 'cold-brew.png';
  if (code.startsWith('TEA_') || sub.includes('TEA') || name.includes('trà') || name.includes('oolong')) return 'oolong.png';
  if (code.includes('MATCHA') && cat !== 'PASTRY') return 'matcha.png';
  if (code.includes('HOJICHA') || name.includes('hojicha') || name.includes('matcha')) return cat === 'PASTRY' ? 'mousse.png' : 'matcha.png';
  if (code === 'WATER_BOTTLE' || sub === 'BOTTLED_WATER' || name.includes('tinh khiết') || name.includes('nước suối')) return 'water.png';
  if (sub === 'JUICE' || code.startsWith('JUICE_') || name.includes('nước cam') || name.includes('nước ép')) return 'juice.png';
  if (sub === 'SODA' || code.startsWith('SODA_') || name.includes('soda')) return 'soda.png';
  if (name.includes('croissant') || name.includes('sừng bò') || name.includes('bơ xốp') || code === 'BAKE_SCONE') return 'croissant.png';
  if (name.includes('mousse') || code.startsWith('MOUSSE_')) return 'mousse.png';
  if (name.includes('tiramisu') || name.includes('cheesecake') || code.startsWith('CAKE_')) return 'tiramisu.png';
  if (name.includes('bánh mì') || name.includes('biscotti') || code === 'BREAD_QUE' || code === 'BAKE_BISCOTTI') return 'bread.png';
  if (name.includes('sandwich')) return 'sandwich.png';
  if (name.includes('trái cây')) return 'fruit.png';
  if (name.includes('màn hình')) return 'monitor.png';
  if (name.includes('bàn phím') || name.includes('chuột')) return 'keyboard.png';
  if (name.includes('cáp') || name.includes('sạc')) return 'powerbank.png';
  if (name.includes('bút') || name.includes('bảng')) return 'stationery.png';
  if (name.includes('in tài liệu')) return 'printer.png';
  if (cat === 'PASTRY') return 'croissant.png';
  if (cat === 'SNACK') return 'sandwich.png';
  return 'coffee.png';
}

function mapProductCategory(raw: any): KenDrinkCategory {
  const cat = String(raw?.category || '').toUpperCase();
  const sub = String(raw?.sub_category || '').toUpperCase();
  if (cat === 'PASTRY' || cat === 'SNACK') return 'bakery';
  if (['FRUIT_TEA', 'JUICE', 'SODA', 'BOTTLED_WATER'].includes(sub)) return 'refreshment';
  return 'coffee';
}

function mapAddonCategory(raw: any): 'drink' | 'food' | 'equipment' {
  const note = String(raw?.operation_note || '').toLocaleLowerCase('vi-VN');
  const name = String(raw?.name || '').toLocaleLowerCase('vi-VN');
  if (
    raw?.unit === 'PER_BOOKING' ||
    note.includes('check-in') && (name.includes('màn hình') || name.includes('bàn phím') || name.includes('sạc') || name.includes('bút') || name.includes('in ') || name.includes('khăn') || name.includes('bộ nghỉ') || name.includes('chăn'))
  ) {
    return 'equipment';
  }
  if (name.includes('bánh') || name.includes('croissant') || name.includes('mousse') || name.includes('tiramisu') || name.includes('cheese') || name.includes('sandwich') || name.includes('trái cây') || name.includes('biscotti') || name.includes('bơ xốp')) {
    return 'food';
  }
  if (name.includes('màn hình') || name.includes('bàn phím') || name.includes('cáp') || name.includes('bút') || name.includes('in tài liệu')) {
    return 'equipment';
  }
  return 'drink';
}

@Injectable({ providedIn: 'root' })
export class KenBookingState {
  private readonly auth = tryInjectAuth();
  private readonly api = tryInjectCustomerApi();
  private readonly storageKey = 'ken-figma-booking-demo-v1';
  readonly draft = signal<KenBookingDraft>(this.load());
  readonly menuProductsSignal = signal<KenProduct[]>([...KEN_MENU]);
  readonly extrasSignal = signal<KenExtra[]>([...KEN_EXTRAS]);
  readonly spacesSignal = signal<KenBookingSpace[]>([...KEN_BOOKING_SPACES]);
  private catalogSynced = false;

  get menuProducts(): KenProduct[] {
    return this.menuProductsSignal();
  }
  get drinks(): KenProduct[] {
    return this.menuProductsSignal().filter(item => item.category !== 'bakery');
  }
  get pastries(): KenProduct[] {
    return this.menuProductsSignal().filter(
      item =>
        item.category === 'bakery' &&
        item.rawCategory !== 'SNACK' &&
        !['sandwich', 'fruit', 'SNACK_SANDWICH', 'SNACK_FRUIT'].includes(item.id),
    );
  }
  get extras(): KenExtra[] {
    return this.extrasSignal();
  }
  get spaces(): KenBookingSpace[] {
    return this.spacesSignal();
  }

  constructor() {
    this.syncCatalogFromApi();
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

  syncCatalogFromApi(force = false): void {
    if (!this.api || (this.catalogSynced && !force)) return;
    this.catalogSynced = true;
    forkJoin({
      products: this.api.getProducts().pipe(catchError(() => of([]))),
      addons: this.api.getAddons().pipe(catchError(() => of([]))),
      spaces: this.api.getSpaces().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ products, addons, spaces }) => {
        if (Array.isArray(products) && products.length > 0) {
          const mappedProducts: KenProduct[] = products
            .filter((p) => p && p.is_active !== false)
            .map((p) => {
              const code = String(p.item_code || '').toUpperCase();
              const canonicalId = CANONICAL_PRODUCT_SLUGS[code] || code || String(p._id);
              const variantsText = Array.isArray(p.variants) && p.variants.length
                ? p.variants
                    .map((v: any) => (v && typeof v === 'object' ? (v.name ?? v.label ?? v.title ?? '') : String(v ?? '')))
                    .map((v: string) => String(v).trim())
                    .filter(Boolean)
                    .join(' / ')
                : '';
              return {
                id: canonicalId,
                apiProductId: String(p._id),
                itemCode: code || undefined,
                rawCategory: String(p.category || 'DRINK').toUpperCase(),
                name: String(p.name || 'Sản phẩm KÉN'),
                price: Number(p.price ?? 0),
                image: resolveProductImage(p),
                category: mapProductCategory(p),
                description: String(p.description || variantsText || 'Món phục vụ tại KÉN'),
              };
            });
          if (mappedProducts.length > 0) {
            this.menuProductsSignal.set(mappedProducts);
          }
        }

        if (Array.isArray(addons) && addons.length > 0) {
          const mappedAddons: KenExtra[] = addons
            .filter((a) => a && a.is_active !== false)
            .map((a) => {
              const lowerName = String(a.name || '').trim().toLocaleLowerCase('vi-VN');
              const canonicalId = CANONICAL_ADDON_SLUGS[lowerName] || String(a._id);
              return {
                id: canonicalId,
                apiAddonId: String(a._id),
                title: String(a.name || 'Dịch vụ cộng thêm'),
                price: Number(a.price ?? 0),
                image: resolveProductImage(a),
                category: mapAddonCategory(a),
                unit: a.unit === 'PER_BOOKING' ? 'PER_BOOKING' : 'PER_ITEM',
              };
            });
          if (mappedAddons.length > 0) {
            this.extrasSignal.set(mappedAddons);
          }
        }

        if (Array.isArray(spaces) && spaces.length > 0) {
          const updatedSpaces = this.spacesSignal().map((base) => {
            const match = spaces.find((s) => SPACE_CODE_TO_LOCAL[String(s.space_code || '').toUpperCase()] === base.id);
            if (!match) return base;
            return {
              ...base,
              name: match.name || base.name,
              description: match.description || base.description,
              minGuests: Number(match.min_guests ?? base.minGuests),
              maxGuests: Number(match.max_guests ?? base.maxGuests),
              perPerson: match.booking_mode === 'SHARED',
            };
          });
          this.spacesSignal.set(updatedSpaces);
        }
      },
      error: () => {
        this.catalogSynced = false;
      },
    });
  }

  private resetForUser(ownerUserId: string | null): void {
    const clean = { ...this.defaults(), ownerUserId };
    this.draft.set(clean);
    try { localStorage.setItem(this.storageKey, JSON.stringify(clean)); } catch {}
  }

  private defaults(): KenBookingDraft {
    return {
      spaceId: 'focus', date: kenNextDay(), startHour: 9, hours: 4, guests: 1,
      drinkId: 'matcha', drinkQuantities: {}, pastryQuantities: {}, extras: {}, fullName: '', phone: '', email: '', note: '',
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
      const state: KenBookingDraft = {
        ...empty, ...obj,
        drinkQuantities: { ...empty.drinkQuantities, ...(obj.drinkQuantities || {}) },
        pastryQuantities: { ...empty.pastryQuantities, ...(obj.pastryQuantities || {}) },
        extras: { ...empty.extras, ...(obj.extras || {}) }
      };
      const space = kenBookingSpace(state.spaceId);
      state.spaceId = space.id;
      const isHourlySpace = space.id === 'work' || space.id === 'focus';
      const minHourly = 1;
      if (!space.rates.some(rate => rate.hours === state.hours) && !(isHourlySpace && state.hours >= minHourly && state.hours <= 14)) {
        state.hours = space.rates[0].hours;
      }
      if (!/^\d{4}-\d\d-\d\d$/.test(state.date) || state.date < new Date().toLocaleDateString('en-CA')) state.date = kenNextDay();
      if (!Number.isInteger(state.startHour) || state.startHour < 8 || state.startHour + state.hours > 22) state.startHour = 9;
      state.guests = Math.max(space.minGuests, Math.min(space.maxGuests, Number(state.guests) || space.minGuests));
      if (this.hasNoDrinkInclusionMenu(space.id, state.hours) || (space.id === 'focus' && state.hours !== 4 && Object.keys(state.drinkQuantities).length === 0)) {
        state.drinkId = null;
        state.drinkQuantities = {};
      }
      if (this.requiredPastryCountFor(space.id, state.hours, state.guests) === 0) {
        state.pastryQuantities = {};
      }
      for (const key of Object.keys(state.extras)) {
        const cap = this.maxExtraCount(key);
        if ((state.extras[key] || 0) > cap) state.extras[key] = cap;
      }
      return state;
    } catch {
      return empty;
    }
  }

  set(change: Partial<KenBookingDraft>): void {
    const previous = this.draft();
    const next: KenBookingDraft = { ...previous, ...change };
    if (change.spaceId !== undefined && change.spaceId !== previous.spaceId) {
      const space = kenBookingSpace(change.spaceId);
      if (change.hours === undefined) next.hours = space.rates[0].hours;
      if (change.guests === undefined) {
        next.guests = Math.max(space.minGuests, Math.min(space.maxGuests, previous.guests));
      }
      next.drinkId = null;
      next.drinkQuantities = {};
      next.pastryQuantities = {};
      next.extras = {};
    } else if (
      (change.guests !== undefined && change.guests !== previous.guests) ||
      (change.hours !== undefined && change.hours !== previous.hours)
    ) {
      if (change.drinkQuantities === undefined && change.drinkId === undefined) {
        next.drinkId = null;
        next.drinkQuantities = {};
      }
      if (change.pastryQuantities === undefined) {
        next.pastryQuantities = {};
      }
    }

    if (this.hasNoDrinkInclusionMenu(next.spaceId, next.hours)) {
      next.drinkId = null;
      next.drinkQuantities = {};
    }
    if (this.requiredPastryCountFor(next.spaceId, next.hours, next.guests) === 0) {
      next.pastryQuantities = {};
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
      (change.pastryQuantities !== undefined &&
       JSON.stringify(change.pastryQuantities) !== JSON.stringify(previous.pastryQuantities)) ||
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

  maxExtraCount(id: string): number {
    const found = this.extras.find(item => item.id === id);
    return found?.unit === 'PER_BOOKING' ? 1 : 9;
  }

  setExtra(id: string, count: number): void {
    if (!this.extras.some(item => item.id === id)) return;
    const extras = { ...this.draft().extras, [id]: Math.max(0, Math.min(this.maxExtraCount(id), count)) };
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

  setPastryQuantity(id: string, count: number): void {
    if (!this.pastries.some(item => item.id === id)) return;
    const pastryQuantities = { ...this.draft().pastryQuantities };
    const quantityLimit = this.requiredPastryCount || 9;
    const quantity = Math.max(0, Math.min(quantityLimit, count));
    if (quantity === 0) delete pastryQuantities[id];
    else pastryQuantities[id] = quantity;
    this.set({ pastryQuantities });
  }

  get space(): KenBookingSpace {
    return this.getSpace(this.draft().spaceId) || kenBookingSpace(this.draft().spaceId);
  }
  getSpace(id: string): KenBookingSpace | undefined {
    return this.spacesSignal().find(space => space.id === id);
  }
  get isFocusSpace(): boolean { return this.draft().spaceId === 'focus'; }
  get isHourlyWork(): boolean {
    return this.draft().spaceId === 'work' && this.draft().hours !== 4 && this.draft().hours !== 14;
  }
  private hasNoDrinkInclusionMenu(spaceId: string, hours: number): boolean {
    return spaceId === 'meeting-small'
      || spaceId === 'meeting-large'
      || (spaceId === 'work' && hours !== 4 && hours !== 14)
      || (['single', 'double', 'private'].includes(spaceId) && hours === 1);
  }
  private requiredDrinkCountFor(spaceId: string, hours: number, guests: number): number {
    if (spaceId === 'focus') return hours === 4 ? 1 : 0;
    if (spaceId === 'work') {
      if (hours === 14) return guests * 2;
      if (hours === 4) return guests;
      return 0;
    }
    if (spaceId === 'meeting-small' || spaceId === 'meeting-large') return 0;
    if (hours === 1) return 0;
    if (hours === 8) return guests * 2;
    return guests;
  }
  private requiredPastryCountFor(spaceId: string, hours: number, guests: number): number {
    if (spaceId === 'work' && hours === 14) return guests;
    if (['single', 'double', 'private'].includes(spaceId) && (hours === 4 || hours === 8)) return guests;
    return 0;
  }
  get requiredDrinkCount(): number {
    const d = this.draft();
    return this.requiredDrinkCountFor(d.spaceId, d.hours, d.guests);
  }
  get requiredPastryCount(): number {
    const d = this.draft();
    return this.requiredPastryCountFor(d.spaceId, d.hours, d.guests);
  }
  get selectedDrinkCount(): number {
    const d = this.draft();
    if (this.hasNoDrinkInclusionMenu(d.spaceId, d.hours)) return 0;
    const quantities = d.drinkQuantities;
    if (Object.keys(quantities).length > 0) {
      return Object.values(quantities).reduce((total, count) => total + count, 0);
    }
    if (this.requiredDrinkCount > 0 && d.drinkId) {
      return 1;
    }
    return 0;
  }
  drinkQuantity(id: string): number {
    const d = this.draft();
    if (this.hasNoDrinkInclusionMenu(d.spaceId, d.hours)) return 0;
    const quantities = d.drinkQuantities;
    if (Object.keys(quantities).length > 0) {
      return quantities[id] || 0;
    }
    if (this.requiredDrinkCount > 0 && d.drinkId === id) {
      return 1;
    }
    return 0;
  }
  get selectedDrinks(): Array<{ product: KenProduct; quantity: number }> {
    const d = this.draft();
    if (this.hasNoDrinkInclusionMenu(d.spaceId, d.hours)) return [];
    return this.drinks
      .map(product => ({ product, quantity: this.drinkQuantity(product.id) }))
      .filter(item => item.quantity > 0);
  }
  pastryQuantity(id: string): number {
    if (this.requiredPastryCount === 0) return 0;
    return this.draft().pastryQuantities?.[id] || 0;
  }
  get selectedPastryCount(): number {
    if (this.requiredPastryCount === 0) return 0;
    return Object.values(this.draft().pastryQuantities || {}).reduce((total, count) => total + count, 0);
  }
  get selectedPastries(): Array<{ product: KenProduct; quantity: number }> {
    if (this.requiredPastryCount === 0) return [];
    return this.pastries
      .map(product => ({ product, quantity: this.pastryQuantity(product.id) }))
      .filter(item => item.quantity > 0);
  }
  get selectedExtrasList(): Array<{ extra: KenExtra; quantity: number }> {
    const extrasMap = this.draft().extras || {};
    return this.extras
      .map(extra => ({ extra, quantity: Math.max(0, Math.min(this.maxExtraCount(extra.id), extrasMap[extra.id] || 0)) }))
      .filter(item => item.quantity > 0);
  }

  get freeWaterCount(): number {
    const d = this.draft();
    if (d.spaceId === 'meeting-small' || d.spaceId === 'meeting-large') {
      return d.guests;
    }
    const isHourly = (d.spaceId === 'work' && d.hours !== 4 && d.hours !== 14) ||
                     (d.spaceId === 'focus' && d.hours !== 4);
    if (isHourly && d.hours >= 2) {
      return this.space.perPerson ? d.guests : 1;
    }
    return 0;
  }
  get fixedEquipment(): string[] {
    const id = this.draft().spaceId;
    return (id === 'meeting-small' || id === 'meeting-large') ? ['Máy chiếu', 'Bảng từ'] : [];
  }
  get fixedInclusionsList(): Array<{ label: string; quantity: number }> {
    const list: Array<{ label: string; quantity: number }> = this.fixedEquipment.map(label => ({ label, quantity: 1 }));
    if (this.freeWaterCount > 0) {
      list.push({ label: 'Nước suối', quantity: this.freeWaterCount });
    }
    return list;
  }
  get packageName(): string {
    const d = this.draft();
    if (d.spaceId === 'work') {
      if (d.hours === 4) return 'Gói Nửa ngày (4 giờ)';
      if (d.hours === 14) return 'Gói Cả ngày';
      return 'Gói Linh hoạt';
    }
    if (d.spaceId === 'focus') {
      return d.hours === 4 ? 'Tập trung nửa ngày (4 giờ)' : 'Tập trung theo giờ';
    }
    if (d.spaceId === 'meeting-small') return 'Họp nhóm nhỏ (3 giờ)';
    if (d.spaceId === 'meeting-large') return 'Họp nhóm lớn (3 giờ)';
    if (d.hours === 1) return 'Nghỉ nhanh (1 giờ)';
    if (d.hours === 2) return 'Ngả lưng (2 giờ)';
    if (d.hours === 4) return 'Trú ẩn (4 giờ)';
    return 'Nguyên ngày (8 giờ)';
  }
  get packageInclusionSummary(): string {
    const d = this.draft();
    if (d.spaceId === 'work') {
      if (d.hours === 4) return 'Mỗi khách 01 đồ uống Menu Tiêu chuẩn';
      if (d.hours === 14) return 'Mỗi khách 02 đồ uống Menu Tiêu chuẩn và 01 bánh';
      return 'Mỗi khách 01 chai nước suối (nếu đặt từ 2 giờ trở lên)';
    }
    if (d.spaceId === 'focus') {
      return d.hours === 4
        ? '01 đồ uống Menu Tiêu chuẩn'
        : '01 chai nước suối (nếu đặt từ 2 giờ trở lên)';
    }
    if (d.spaceId === 'meeting-small' || d.spaceId === 'meeting-large') {
      return 'Máy chiếu và bảng từ; mỗi khách 01 chai nước suối';
    }
    if (d.hours === 1) return 'Không bao gồm F&B';
    if (d.hours === 2) return 'Mỗi khách 01 đồ uống Menu Tiêu chuẩn';
    if (d.hours === 4) return 'Mỗi khách 01 đồ uống Menu Tiêu chuẩn và 01 bánh';
    return 'Mỗi khách 02 đồ uống Menu Tiêu chuẩn và 01 bánh';
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
    return this.requiredDrinkCount > 0 ? 50000 : 0;
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
  image(file: string): string {
    if (!file) return '/images/ken-flow/coffee.png';
    if (file.startsWith('/') || file.startsWith('http')) return file;
    return '/images/ken-flow/' + file;
  }
}
