import { Injectable, effect, inject, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthService } from '../../../core/auth.service';
import { CustomerApiService, ApiBookingQuote } from '../../../core/customer-api.service';

export type KenZone = 'focus' | 'rest';
export type KenDrinkCategory = 'coffee' | 'refreshment' | 'bakery';
export type KenTemperature = 'Nóng' | 'Lạnh';
export type KenSize = 'M' | 'L';

export interface KenProductVariant {
  name: string;
  price: number;
}

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
  variants?: KenProductVariant[];
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
  { id: 'coffee', itemCode: 'CF_DEN', name: 'Cà phê Đen / Sữa', price: 40000, image: '/images/addons/cf-den.png', category: 'coffee', description: 'Nóng / Lạnh', variants: [{ name: 'Nóng', price: 40000 }, { name: 'Lạnh', price: 40000 }] },
  { id: 'americano', itemCode: 'CF_AMERICANO', name: 'Americano', price: 40000, image: '/images/addons/cf-americano.png', category: 'coffee', description: 'Nóng / Lạnh', variants: [{ name: 'Nóng', price: 40000 }, { name: 'Lạnh', price: 40000 }] },
  { id: 'bac-xiu', itemCode: 'CF_BAC_XIU', name: 'Bạc Xỉu / Salted Caramel Coffee', price: 45000, image: '/images/addons/cf-bac-xiu.png', category: 'coffee', description: 'Nóng / Lạnh', variants: [{ name: 'Nóng', price: 45000 }, { name: 'Lạnh', price: 45000 }] },
  { id: 'cold-brew', itemCode: 'CF_COLD_BREW', name: 'Cold Brew Truyền thống / Trái cây', price: 50000, image: '/images/addons/cf-cold-brew.png', category: 'coffee', description: 'Lạnh', variants: [{ name: 'Lạnh', price: 50000 }] },
  { id: 'oolong', itemCode: 'TEA_OOLONG_MACCHIATO', name: 'Trà Oolong Macchiato / Trà Đào', price: 50000, image: '/images/addons/tea-oolong-macchiato.png', category: 'coffee', description: 'Lạnh', variants: [{ name: 'Lạnh', price: 50000 }] },
  { id: 'matcha', itemCode: 'MATCHA_LATTE', name: 'Matcha Latte', price: 55000, image: '/images/addons/matcha-latte.png', category: 'coffee', description: 'Nóng / Lạnh, Size M (55k) / L (60k)', variants: [{ name: 'Nóng, M (500 ml)', price: 55000 }, { name: 'Nóng, L (700 ml)', price: 60000 }, { name: 'Lạnh, M (500 ml)', price: 55000 }, { name: 'Lạnh, L (700 ml)', price: 60000 }] },
  { id: 'hojicha', itemCode: 'HOJICHA_LATTE', name: 'Hojicha Latte', price: 55000, image: '/images/addons/hojicha-latte.png', category: 'coffee', description: 'Nóng / Lạnh, Size M (55k) / L (60k)', variants: [{ name: 'Nóng, M (500 ml)', price: 55000 }, { name: 'Nóng, L (700 ml)', price: 60000 }, { name: 'Lạnh, M (500 ml)', price: 55000 }, { name: 'Lạnh, L (700 ml)', price: 60000 }] },
  { id: 'water', itemCode: 'WATER_BOTTLE', name: 'Nước tinh khiết (chai)', price: 15000, image: '/images/addons/water-bottle.png', category: 'refreshment', description: 'Chai 500 ml', variants: [{ name: 'Chai', price: 15000 }] },
  { id: 'juice', itemCode: 'JUICE_CAM', name: 'Nước cam / Nước ép chanh dây', price: 45000, image: '/images/addons/juice-cam.png', category: 'refreshment', description: 'Lạnh', variants: [{ name: 'Lạnh', price: 45000 }] },
  { id: 'soda', itemCode: 'SODA_TRAI_CAY', name: 'Soda trái cây', price: 45000, image: '/images/addons/soda-trai-cay.png', category: 'refreshment', description: 'Lạnh', variants: [{ name: 'Lạnh', price: 45000 }] },
  { id: 'croissant', itemCode: 'BAKE_CROISSANT', name: 'Bánh sừng bò (Croissant) cơ bản', price: 35000, image: '/images/addons/bake-croissant.png', category: 'bakery', description: 'Một chiếc bánh cho buổi cà phê' },
  { id: 'mousse', itemCode: 'MOUSSE_MATCHA', name: 'Bánh Mousse', price: 45000, image: '/images/addons/mousse-matcha.png', category: 'bakery', description: 'Trà xanh / Chanh dây' },
  { id: 'tiramisu', itemCode: 'CAKE_TIRAMISU', name: 'Tiramisu / Cheesecake', price: 50000, image: '/images/addons/cake-tiramisu.png', category: 'bakery', description: 'Chọn tiramisu hoặc cheesecake' },
  { id: 'bread', itemCode: 'BREAD_QUE', name: 'Bánh mì que', price: 30000, image: '/images/addons/bread-que.png', category: 'bakery', description: 'Gọn nhẹ cho một khoảng nghỉ' },
  { id: 'sandwich', itemCode: 'SNACK_SANDWICH', name: 'Sandwich', price: 45000, image: '/images/addons/snack-sandwich.png', category: 'bakery', description: 'Ăn nhẹ, rồi thong thả chuyện trò' },
  { id: 'fruit', itemCode: 'SNACK_FRUIT', name: 'Trái cây cắt sẵn', price: 40000, image: '/images/addons/snack-fruit.png', category: 'bakery', description: 'Thêm chút tươi mới cho ngày' }
];

export interface KenExtra {
  id: string;
  apiAddonId?: string;
  itemCode?: string;
  title: string;
  price: number;
  image: string;
  category: 'drink' | 'food' | 'equipment';
  unit?: 'PER_ITEM' | 'PER_BOOKING';
  variants?: KenProductVariant[];
}

export const KEN_EXTRAS: KenExtra[] = [
  { id: 'extra-coffee', itemCode: 'CF_DEN', title: 'Cà phê Đen/Sữa', price: 40000, image: '/images/addons/cf-den.png', category: 'drink', unit: 'PER_ITEM', variants: [{ name: 'Nóng', price: 40000 }, { name: 'Lạnh', price: 40000 }] },
  { id: 'extra-americano', itemCode: 'CF_AMERICANO', title: 'Americano', price: 40000, image: '/images/addons/cf-americano.png', category: 'drink', unit: 'PER_ITEM', variants: [{ name: 'Nóng', price: 40000 }, { name: 'Lạnh', price: 40000 }] },
  { id: 'extra-matcha', itemCode: 'MATCHA_LATTE', title: 'Matcha Latte', price: 55000, image: '/images/addons/matcha-latte.png', category: 'drink', unit: 'PER_ITEM', variants: [{ name: 'Nóng, M (500 ml)', price: 55000 }, { name: 'Nóng, L (700 ml)', price: 60000 }, { name: 'Lạnh, M (500 ml)', price: 55000 }, { name: 'Lạnh, L (700 ml)', price: 60000 }] },
  { id: 'extra-hojicha', itemCode: 'HOJICHA_LATTE', title: 'Hojicha Latte', price: 55000, image: '/images/addons/hojicha-latte.png', category: 'drink', unit: 'PER_ITEM', variants: [{ name: 'Nóng, M (500 ml)', price: 55000 }, { name: 'Nóng, L (700 ml)', price: 60000 }, { name: 'Lạnh, M (500 ml)', price: 55000 }, { name: 'Lạnh, L (700 ml)', price: 60000 }] },
  { id: 'extra-water', itemCode: 'WATER_BOTTLE', title: 'Nước suối', price: 15000, image: '/images/addons/water-bottle.png', category: 'drink', unit: 'PER_ITEM', variants: [{ name: 'Chai', price: 15000 }] },
  { id: 'extra-juice', itemCode: 'JUICE_CAM', title: 'Nước cam', price: 45000, image: '/images/addons/juice-cam.png', category: 'drink', unit: 'PER_ITEM', variants: [{ name: 'Lạnh', price: 45000 }] },
  { id: 'extra-croissant', itemCode: 'BAKE_CROISSANT', title: 'Bánh sừng bò (Croissant)', price: 35000, image: '/images/addons/bake-croissant.png', category: 'food', unit: 'PER_ITEM' },
  { id: 'extra-mousse', itemCode: 'MOUSSE_MATCHA', title: 'Bánh Mousse', price: 45000, image: '/images/addons/mousse-matcha.png', category: 'food', unit: 'PER_ITEM' },
  { id: 'extra-sandwich', itemCode: 'SNACK_SANDWICH', title: 'Sandwich', price: 45000, image: '/images/addons/snack-sandwich.png', category: 'food', unit: 'PER_ITEM' },
  { id: 'extra-fruit', itemCode: 'SNACK_FRUIT', title: 'Trái cây cắt sẵn', price: 40000, image: '/images/addons/snack-fruit.png', category: 'food', unit: 'PER_ITEM' },
  { id: 'extra-monitor', title: 'Màn hình 24”', price: 50000, image: '/images/addons/eq-monitor.png', category: 'equipment', unit: 'PER_BOOKING' },
  { id: 'extra-keyboard', title: 'Bàn phím & chuột', price: 30000, image: '/images/addons/eq-keyboard-mouse.png', category: 'equipment', unit: 'PER_BOOKING' },
  { id: 'extra-phone', title: 'Cáp & sạc dự phòng', price: 20000, image: '/images/addons/eq-cable-powerbank.png', category: 'equipment', unit: 'PER_BOOKING' },
  { id: 'extra-stationery', title: 'Bộ bút & bảng', price: 15000, image: '/images/addons/eq-pen-board.png', category: 'equipment', unit: 'PER_BOOKING' },
  { id: 'extra-printer', title: 'In tài liệu', price: 20000, image: '/images/addons/eq-print-a4.png', category: 'equipment', unit: 'PER_ITEM' }
];

export interface KenBookingDraft {
  spaceId: string;
  date: string;
  startHour: number;
  hours: number;
  guests: number;
  drinkId: string | null;
  drinkQuantities: Record<string, number>;
  drinkVariants?: Record<string, string>;
  pastryQuantities: Record<string, number>;
  extras: Record<string, number>;
  extraVariants?: Record<string, string>;
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
  CF_SUA: 'coffee-milk',
  CF_AMERICANO: 'americano',
  CF_BAC_XIU: 'bac-xiu',
  CF_SALTED_CARAMEL: 'salted-caramel',
  CF_PHIN: 'coffee-phin',
  CF_COLD_BREW: 'cold-brew',
  TEA_OOLONG_MACCHIATO: 'oolong',
  TEA_DAO: 'tea-dao',
  TEA_CHAI: 'tea-chai',
  MATCHA_LATTE: 'matcha',
  HOJICHA_LATTE: 'hojicha',
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
  'cà phê sữa': 'extra-coffee-milk',
  americano: 'extra-americano',
  'bạc xỉu': 'extra-bac-xiu',
  'salted caramel coffee': 'extra-salted-caramel',
  'cà phê phin truyền thống': 'extra-coffee-phin',
  'trà đào': 'extra-tea-dao',
  'hồng trà oolong macchiato': 'extra-oolong',
  'trà chai ấn độ': 'extra-tea-chai',
  'matcha latte': 'extra-matcha',
  'hojicha latte': 'extra-hojicha',
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

export const LOCAL_TO_SPACE_CODE: Record<string, string> = {
  focus: 'FP-01',
  work: 'WL-01',
  'meeting-small': 'SMR-01',
  'meeting-large': 'BR-01',
  single: 'SBP-01',
  double: 'DBP-01',
  private: 'PS-01',
};

function resolveProductImage(raw: any): string {
  const code = String(raw?.item_code || '').toUpperCase();
  const sub = String(raw?.sub_category || '').toUpperCase();
  const cat = String(raw?.category || '').toUpperCase();
  const name = String(raw?.name || raw?.title || '').toLocaleLowerCase('vi-VN');

  const url = typeof raw?.image_url === 'string' ? raw.image_url.trim() : '';
  if (url.startsWith('/images/addons/') || url.startsWith('http') || url.startsWith('data:')) {
    return url;
  }

  if (code === 'CF_AMERICANO' || name.includes('americano')) return '/images/addons/cf-americano.png';
  if (code === 'CF_SALTED_CARAMEL' || name.includes('caramel')) return '/images/addons/cf-salted-caramel.png';
  if (code === 'CF_BAC_XIU' || name.includes('bạc xỉu')) return '/images/addons/cf-bac-xiu.png';
  if (code === 'CF_COLD_BREW_FRUIT' || (name.includes('cold brew') && name.includes('trái cây'))) return '/images/addons/cf-cold-brew-fruit.png';
  if (code.includes('COLD_BREW') || name.includes('cold brew')) return '/images/addons/cf-cold-brew.png';
  if (code === 'CF_SUA' || name.includes('cà phê sữa')) return '/images/addons/cf-sua.png';
  if (code === 'CF_PHIN' || name.includes('phin')) return '/images/addons/cf-phin.png';
  if (code === 'CF_ESPRESSO' || name.includes('espresso')) return '/images/addons/cf-espresso.png';
  if (code === 'TEA_DAO' || name.includes('trà đào')) return '/images/addons/tea-dao.png';
  if (code === 'TEA_LUC' || name.includes('lục trà')) return '/images/addons/tea-luc.png';
  if (code === 'TEA_THAO_MOC' || name.includes('thảo mộc')) return '/images/addons/tea-thao-moc.png';
  if (code === 'TEA_CHAI' || name.includes('chai ấn độ')) return '/images/addons/tea-chai.png';
  if (code.startsWith('TEA_') || sub.includes('TEA') || name.includes('trà') || name.includes('oolong')) return '/images/addons/tea-oolong-macchiato.png';
  if (code.includes('MATCHA') && cat !== 'PASTRY' && !name.includes('mousse')) return '/images/addons/matcha-latte.png';
  if (code.includes('HOJICHA') || name.includes('hojicha')) return '/images/addons/hojicha-latte.png';
  if (code === 'CHOC_NONG' || name.includes('sô-cô-la')) return '/images/addons/choc-nong.png';
  if (code === 'WATER_BOTTLE' || sub === 'BOTTLED_WATER' || name.includes('tinh khiết') || name.includes('nước suối')) return '/images/addons/water-bottle.png';
  if (code === 'JUICE_CHANH_DAY' || (name.includes('chanh dây') && !name.includes('mousse'))) return '/images/addons/juice-chanh-day.png';
  if (sub === 'JUICE' || code.startsWith('JUICE_') || name.includes('nước cam') || name.includes('nước ép')) return '/images/addons/juice-cam.png';
  if (sub === 'SODA' || code.startsWith('SODA_') || name.includes('soda')) return '/images/addons/soda-trai-cay.png';
  if (code === 'BAKE_SCONE' || name.includes('bơ xốp')) return '/images/addons/bake-scone.png';
  if (name.includes('croissant') || name.includes('sừng bò')) return '/images/addons/bake-croissant.png';
  if (code === 'MOUSSE_CHANH_DAY' || (name.includes('mousse') && name.includes('chanh dây'))) return '/images/addons/mousse-chanh-day.png';
  if (name.includes('mousse') || code.startsWith('MOUSSE_')) return '/images/addons/mousse-matcha.png';
  if (code === 'CAKE_CHEESE' || name.includes('cheesecake')) return '/images/addons/cake-cheese.png';
  if (name.includes('tiramisu') || code.startsWith('CAKE_')) return '/images/addons/cake-tiramisu.png';
  if (code === 'BAKE_BISCOTTI' || name.includes('biscotti') || name.includes('bánh quy')) return '/images/addons/bake-biscotti.png';
  if (name.includes('bánh mì') || code === 'BREAD_QUE') return '/images/addons/bread-que.png';
  if (name.includes('sandwich')) return '/images/addons/snack-sandwich.png';
  if (name.includes('trái cây')) return '/images/addons/snack-fruit.png';
  if (name.includes('màn hình')) return '/images/addons/eq-monitor.png';
  if (name.includes('bàn phím') || name.includes('chuột')) return '/images/addons/eq-keyboard-mouse.png';
  if (name.includes('cáp') || name.includes('sạc')) return '/images/addons/eq-cable-powerbank.png';
  if (name.includes('bút') || name.includes('bảng')) return '/images/addons/eq-pen-board.png';
  if (name.includes('in tài liệu')) return '/images/addons/eq-print-a4.png';
  if (name.includes('khăn ấm')) return '/images/addons/eq-warm-towel.png';
  if (name.includes('bộ nghỉ') || name.includes('bịt mắt')) return '/images/addons/eq-rest-kit.png';
  if (name.includes('chăn')) return '/images/addons/eq-blanket.png';
  if (cat === 'PASTRY') return '/images/addons/bake-croissant.png';
  if (cat === 'SNACK') return '/images/addons/snack-sandwich.png';
  return '/images/addons/cf-den.png';
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
  readonly quoteSignal = signal<ApiBookingQuote | null>(null);
  readonly isQuotingSignal = signal<boolean>(false);
  private catalogSynced = false;

  rawSpaces: any[] = [];
  rawPackages: any[] = [];
  rawPricing: any[] = [];
  rawPackageInclusions: any[] = [];
  rawProducts: any[] = [];
  rawAddons: any[] = [];

  get quote(): ApiBookingQuote | null {
    return this.quoteSignal();
  }
  get isQuoting(): boolean {
    return this.isQuotingSignal();
  }

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

  /** Gợi ý theo cụm ML của khách (users.ml_cluster_id -> ml_cluster_recommendations). */
  readonly clusterRecSignal = signal<{ clusterId: number; personaName: string | null; items: any[] } | null>(null);
  private clusterRecLoaded = false;
  private lastRecUserId: string | null | undefined = undefined;

  loadClusterRecommendations(force = false, onDone?: () => void): void {
    if (!this.api || typeof this.api.getBookingRecommendations !== 'function') {
      onDone?.();
      return;
    }
    if (this.clusterRecLoaded && !force) {
      onDone?.();
      return;
    }
    this.clusterRecLoaded = true;
    const params: Record<string, string> = {};
    if (this.auth?.user?.id) params['userId'] = this.auth.user.id;
    const userCluster = this.auth?.user?.mlClusterId ?? this.auth?.user?.ml_cluster_id;
    if (userCluster !== undefined && userCluster !== null) {
      params['clusterId'] = String(userCluster);
    }
    this.api.getBookingRecommendations(params).pipe(catchError(() => of(null))).subscribe((res: any) => {
      const rec = res?.clusterRecommendation;
      const validRec = rec && Array.isArray(rec.items) && rec.items.length ? rec : null;
      this.clusterRecSignal.set(validRec);
      if (validRec) {
        this.mergeRecommendedCatalogFallbacks(validRec.items);
      }
      onDone?.();
    });
  }

  private mergeRecommendedCatalogFallbacks(items: any[]): void {
    const currentProds = [...this.menuProductsSignal()];
    let prodChanged = false;
    for (const it of items) {
      const matched = this.findCatalogProductForRec(it, currentProds);
      if (!matched) {
        currentProds.push(this.buildFallbackProductFromRec(it));
        prodChanged = true;
      }
    }
    if (prodChanged) {
      this.menuProductsSignal.set(currentProds);
    }

    const currentExtras = [...this.extrasSignal()];
    let extraChanged = false;
    for (const it of items) {
      if (!it.addonId && !it.itemCode && !it.name) continue;
      const matched = this.findCatalogExtraForRec(it, currentExtras);
      if (!matched) {
        currentExtras.push(this.buildFallbackExtraFromRec(it));
        extraChanged = true;
      }
    }
    if (extraChanged) {
      this.extrasSignal.set(currentExtras);
    }
  }

  private findCatalogProductForRec(it: any, list: KenProduct[]): KenProduct | undefined {
    const code = String(it?.itemCode || '').trim().toUpperCase();
    const nameKey = String(it?.name || '').trim().toLocaleLowerCase('vi-VN');
    return list.find(
      p =>
        (code && p.itemCode?.toUpperCase() === code) ||
        (it?.productId && p.apiProductId === String(it.productId)) ||
        (nameKey && p.name.trim().toLocaleLowerCase('vi-VN') === nameKey),
    );
  }

  private buildFallbackProductFromRec(it: any): KenProduct {
    const code = String(it?.itemCode || '').trim().toUpperCase();
    const nameKey = String(it?.name || '').trim().toLocaleLowerCase('vi-VN');
    const canonicalId = CANONICAL_PRODUCT_SLUGS[code] || code || String(it?.productId || nameKey);
    const variants: KenProductVariant[] = Array.isArray(it?.variants) ? it.variants : [];
    return {
      id: canonicalId,
      apiProductId: it?.productId ? String(it.productId) : undefined,
      itemCode: code || undefined,
      rawCategory: it?.category ? String(it.category).toUpperCase() : 'DRINK',
      name: String(it?.name || 'Sản phẩm KÉN'),
      price: Number(it?.price ?? 0),
      image: resolveProductImage({
        item_code: code,
        sub_category: it?.subCategory,
        category: it?.category,
        name: it?.name,
        image_url: it?.imageUrl,
      }),
      category: mapProductCategory({ category: it?.category, sub_category: it?.subCategory }),
      description: 'Gợi ý theo nhóm khách hàng',
      variants,
    };
  }

  private findCatalogExtraForRec(it: any, list: KenExtra[]): KenExtra | undefined {
    const code = String(it?.itemCode || '').trim().toUpperCase();
    const nameKey = String(it?.addonName || it?.name || '').trim().toLocaleLowerCase('vi-VN');
    return list.find(
      e =>
        (it?.addonId && e.apiAddonId === String(it.addonId)) ||
        (code && e.itemCode?.toUpperCase() === code) ||
        (nameKey && e.title.trim().toLocaleLowerCase('vi-VN') === nameKey),
    );
  }

  private buildFallbackExtraFromRec(it: any): KenExtra {
    const code = String(it?.itemCode || '').trim().toUpperCase();
    const title = String(it?.addonName || it?.name || 'Món gợi ý');
    const lowerName = title.trim().toLocaleLowerCase('vi-VN');
    const canonicalId =
      CANONICAL_ADDON_SLUGS[lowerName] ||
      (code ? `extra-${code.toLowerCase()}` : String(it?.addonId || it?.productId || lowerName));
    const variants: KenProductVariant[] = Array.isArray(it?.variants) ? it.variants : [];
    return {
      id: canonicalId,
      apiAddonId: it?.addonId ? String(it.addonId) : undefined,
      itemCode: code || undefined,
      title,
      price: Number(it?.addonPrice ?? it?.price ?? 0),
      image: resolveProductImage({
        item_code: code,
        sub_category: it?.subCategory,
        category: it?.category,
        name: title,
        image_url: it?.imageUrl,
      }),
      category: mapAddonCategory({ name: title, unit: 'PER_ITEM' }),
      unit: 'PER_ITEM',
      variants,
    };
  }

  private isInclusionPastry(item: KenProduct): boolean {
    return (
      item.category === 'bakery' &&
      item.rawCategory !== 'SNACK' &&
      !['sandwich', 'fruit', 'SNACK_SANDWICH', 'SNACK_FRUIT'].includes(item.id)
    );
  }

  get clusterId(): number | null {
    const fromRec = this.clusterRecSignal()?.clusterId;
    if (fromRec !== undefined && fromRec !== null && Number.isFinite(Number(fromRec))) {
      return Number(fromRec);
    }
    const fromUser = this.auth?.user?.mlClusterId ?? this.auth?.user?.ml_cluster_id;
    return fromUser !== undefined && fromUser !== null && Number.isFinite(Number(fromUser))
      ? Number(fromUser)
      : null;
  }

  get clusterPersona(): string {
    return this.clusterRecSignal()?.personaName || '';
  }

  /** Món gợi ý có trong menu Inclusion (đồ uống/bánh). */
  get clusterRecProducts(): KenProduct[] {
    const items = this.clusterRecSignal()?.items || [];
    const products = this.menuProductsSignal();
    const out: KenProduct[] = [];
    for (const it of items) {
      const found = this.findCatalogProductForRec(it, products) || this.buildFallbackProductFromRec(it);
      if (!out.some(p => p.id === found.id)) out.push(found);
    }
    return out;
  }

  get clusterRecInclusionDrinks(): KenProduct[] {
    return this.clusterRecProducts.filter(p => p.category !== 'bakery');
  }

  get clusterRecInclusionPastries(): KenProduct[] {
    return this.clusterRecProducts.filter(p => this.isInclusionPastry(p));
  }

  get clusterRecInclusionItems(): KenProduct[] {
    const out: KenProduct[] = [];
    if (this.requiredDrinkCount > 0) {
      out.push(...this.clusterRecInclusionDrinks);
    }
    if (this.requiredPastryCount > 0) {
      for (const p of this.clusterRecInclusionPastries) {
        if (!out.some(x => x.id === p.id)) out.push(p);
      }
    }
    return out;
  }

  inclusionItemQuantity(item: KenProduct): number {
    return this.isInclusionPastry(item) ? this.pastryQuantity(item.id) : this.drinkQuantity(item.id);
  }

  canAddInclusionItem(item: KenProduct): boolean {
    if (this.isInclusionPastry(item)) {
      return (
        this.requiredPastryCount > 0 &&
        (this.selectedPastryCount < this.requiredPastryCount ||
          (this.requiredPastryCount === 1 && this.pastryQuantity(item.id) === 0))
      );
    }
    return (
      this.selectedDrinkCount < (this.requiredDrinkCount || 9) ||
      (this.requiredDrinkCount === 1 && this.drinkQuantity(item.id) === 0)
    );
  }

  addInclusionItem(item: KenProduct, delta = 1): void {
    if (this.isInclusionPastry(item)) {
      if (this.requiredPastryCount <= 0) return;
      if (delta > 0 && this.requiredPastryCount === 1 && this.pastryQuantity(item.id) === 0) {
        this.set({ pastryQuantities: { [item.id]: 1 } });
        return;
      }
      if (delta > 0 && !this.canAddInclusionItem(item)) return;
      this.setPastryQuantity(item.id, this.pastryQuantity(item.id) + delta);
      return;
    }

    if (delta > 0 && this.requiredDrinkCount === 1 && this.drinkQuantity(item.id) === 0) {
      this.set({ drinkId: item.id, drinkQuantities: { [item.id]: 1 } });
      return;
    }
    if (delta > 0 && !this.canAddInclusionItem(item)) return;
    this.setDrinkQuantity(item.id, this.drinkQuantity(item.id) + delta);
  }

  inclusionSurcharge(item: KenProduct): number {
    if (this.isInclusionPastry(item)) return 0;
    return Math.max(0, this.getProductPrice(item) - this.entitlement);
  }

  /** Món gợi ý có trong danh mục Add-on. */
  get clusterRecExtras(): KenExtra[] {
    const items = this.clusterRecSignal()?.items || [];
    const extras = this.extrasSignal();
    const out: KenExtra[] = [];
    for (const it of items) {
      const found = this.findCatalogExtraForRec(it, extras) || this.buildFallbackExtraFromRec(it);
      if (!out.some(e => e.id === found.id)) out.push(found);
    }
    return out;
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
        if (uid !== this.lastRecUserId) {
          this.lastRecUserId = uid;
          this.loadClusterRecommendations(true);
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
      packages: this.api.getPackages().pipe(catchError(() => of([]))),
      pricing: this.api.getPricing().pipe(catchError(() => of([]))),
      packageInclusions: this.api.getPackageInclusions().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ products, addons, spaces, packages, pricing, packageInclusions }) => {
        this.rawSpaces = Array.isArray(spaces) ? spaces : [];
        this.rawPackages = Array.isArray(packages) ? packages : [];
        this.rawPricing = Array.isArray(pricing) ? pricing : [];
        this.rawPackageInclusions = Array.isArray(packageInclusions) ? packageInclusions : [];
        this.rawProducts = Array.isArray(products) ? products : [];
        this.rawAddons = Array.isArray(addons) ? addons : [];

        const productById = new Map<string, any>();
        if (Array.isArray(products) && products.length > 0) {
          for (const p of products) {
            if (p?._id) productById.set(String(p._id), p);
          }
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
                variants: Array.isArray(p.variants) ? p.variants : [],
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
              const linked = a.product_id ? productById.get(String(a.product_id)) : null;
              return {
                id: canonicalId,
                apiAddonId: String(a._id),
                itemCode: linked?.item_code ? String(linked.item_code).toUpperCase() : undefined,
                title: String(a.name || 'Dịch vụ cộng thêm'),
                price: Number(a.price ?? 0),
                image: resolveProductImage({ ...a, item_code: linked?.item_code, image_url: a.image_url || linked?.image_url }),
                category: mapAddonCategory(a),
                unit: a.unit === 'PER_BOOKING' ? 'PER_BOOKING' : 'PER_ITEM',
                variants: Array.isArray(a.variants) ? a.variants : [],
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
            let dynamicRates: KenSpaceRate[] = base.rates;
            if (Array.isArray(pricing) && Array.isArray(packages) && pricing.length > 0) {
              const matchedPrices = pricing.filter((pr: any) => String(pr.space_id) === String(match._id));
              if (matchedPrices.length > 0) {
                const ratesList: KenSpaceRate[] = [];
                for (const pr of matchedPrices) {
                  const pkg = packages.find((p: any) => String(p._id) === String(pr.package_id));
                  if (!pkg || pkg.is_active === false) continue;
                  let hours = 1;
                  if (pkg.package_type === 'HOURLY') {
                    hours = Number(pkg.min_hours ?? 1);
                  } else if (pkg.is_full_day) {
                    hours = 14;
                  } else {
                    hours = Number(pkg.duration_hours ?? 4);
                  }
                  if (!ratesList.some((r) => r.hours === hours)) {
                    ratesList.push({ hours, price: Number(pr.price ?? 0) });
                  }
                }
                if (ratesList.length > 0) {
                  ratesList.sort((a, b) => a.hours - b.hours);
                  dynamicRates = ratesList;
                }
              }
            }
            return {
              ...base,
              name: match.name || base.name,
              description: match.description || base.description,
              minGuests: Number(match.min_guests ?? base.minGuests),
              maxGuests: Number(match.max_guests ?? base.maxGuests),
              perPerson: match.booking_mode === 'SHARED',
              rates: dynamicRates,
            };
          });
          this.spacesSignal.set(updatedSpaces);
        }
        this.fetchQuote();
      },
      error: () => {
        this.catalogSynced = false;
      },
    });
  }

  resolveBackendTarget(): {
    space: any;
    pkg: any;
    startAt: string;
    inclusions: Array<{ packageInclusionId: string; productId: string; quantity: number; variant?: string }>;
    addons: Array<{ addonId: string; quantity: number; variant?: string }>;
    voucherCode?: string;
  } | null {
    const d = this.draft();
    const expectedCode = LOCAL_TO_SPACE_CODE[d.spaceId];
    const space = this.rawSpaces.find((s: any) => s.space_code === expectedCode) || this.rawSpaces[0];
    if (!space?._id) return null;

    const spacePriceDocs = this.rawPricing.filter((pr: any) => String(pr.space_id) === String(space._id));
    const compPkgIds = new Set(spacePriceDocs.map((pr: any) => String(pr.package_id)));
    const compPkgs = this.rawPackages.filter((p: any) => compPkgIds.has(String(p._id)) && p.is_active !== false);

    const pkg =
      (d.hours === 14
        ? compPkgs.find((p: any) => p.is_full_day || p.package_type === 'FULL_DAY' || p.duration_hours === 14)
        : undefined) ||
      compPkgs.find((p: any) => (!p.package_type || p.package_type === 'FIXED') && p.duration_hours === d.hours) ||
      compPkgs.find((p: any) => p.package_type === 'HOURLY') ||
      compPkgs[0];

    if (!pkg?._id) return null;

    const startAt = new Date(`${d.date}T${String(d.startHour).padStart(2, '0')}:00:00+07:00`).toISOString();

    const pkgInclusions = this.rawPackageInclusions.filter((inc: any) => String(inc.package_id) === String(pkg._id) && inc.is_active !== false);
    const drinkInc = pkgInclusions.find((inc: any) => inc.item_type === 'STANDARD_DRINK');
    const pastryInc = pkgInclusions.find((inc: any) => inc.item_type === 'PASTRY');

    const mappedInclusions: Array<{ packageInclusionId: string; productId: string; quantity: number; variant?: string }> = [];
    const extraDrinksAsAddons: Array<{ name: string; quantity: number; variant?: string }> = [];

    const norm = (s: any) => String(s || '').trim().toLocaleLowerCase('vi-VN');

    const findBackendProduct = (itemProd: KenProduct, expectedCat: 'DRINK' | 'PASTRY') => {
      if (itemProd.apiProductId) {
        const byId = this.rawProducts.find((p: any) => String(p._id) === itemProd.apiProductId);
        if (byId) return byId;
      }
      if (itemProd.itemCode) {
        const byCode = this.rawProducts.find((p: any) => norm(p.item_code) === norm(itemProd.itemCode));
        if (byCode) return byCode;
      }
      return this.rawProducts.find(
        (p: any) =>
          String(p._id) === itemProd.id ||
          (norm(p.name) === norm(itemProd.name) && (!p.category || p.category === expectedCat)),
      ) || this.rawProducts.find((p: any) => norm(p.name) === norm(itemProd.name));
    };

    if (drinkInc?._id) {
      let remainingDrinkQuota =
        Number(drinkInc.quantity || 0) * (drinkInc.quantity_basis === 'PER_GUEST' ? d.guests : 1);
      for (const item of this.selectedDrinks) {
        if (remainingDrinkQuota <= 0) {
          extraDrinksAsAddons.push({ name: item.product.name, quantity: item.quantity, variant: item.variant });
          continue;
        }
        const take = Math.min(item.quantity, remainingDrinkQuota);
        const overflow = item.quantity - take;
        const matched = findBackendProduct(item.product, 'DRINK');
        if (matched?._id && take > 0) {
          mappedInclusions.push({
            packageInclusionId: String(drinkInc._id),
            productId: String(matched._id),
            quantity: take,
            ...(item.variant ? { variant: item.variant } : {}),
          });
          remainingDrinkQuota -= take;
        }
        if (overflow > 0) {
          extraDrinksAsAddons.push({ name: item.product.name, quantity: overflow, variant: item.variant });
        }
      }
    } else {
      for (const item of this.selectedDrinks) {
        extraDrinksAsAddons.push({ name: item.product.name, quantity: item.quantity, variant: item.variant });
      }
    }

    if (pastryInc?._id) {
      let remainingPastryQuota =
        Number(pastryInc.quantity || 0) * (pastryInc.quantity_basis === 'PER_GUEST' ? d.guests : 1);
      for (const item of this.selectedPastries) {
        if (remainingPastryQuota <= 0) break;
        const take = Math.min(item.quantity, remainingPastryQuota);
        const matched = findBackendProduct(item.product, 'PASTRY');
        if (matched?._id && take > 0) {
          mappedInclusions.push({
            packageInclusionId: String(pastryInc._id),
            productId: String(matched._id),
            quantity: take,
          });
          remainingPastryQuota -= take;
        }
      }
    }

    const mappedAddons: Array<{ addonId: string; quantity: number; variant?: string }> = [];
    const addMappedAddon = (addonObj: any, qty: number, variant?: string) => {
      if (!addonObj?._id || qty < 1) return;
      const clamped = addonObj.unit === 'PER_BOOKING' ? 1 : qty;
      const existing = mappedAddons.find((a) => a.addonId === String(addonObj._id) && a.variant === variant);
      if (existing) {
        existing.quantity = addonObj.unit === 'PER_BOOKING' ? 1 : existing.quantity + clamped;
      } else {
        mappedAddons.push({
          addonId: String(addonObj._id),
          quantity: clamped,
          ...(variant ? { variant } : {}),
        });
      }
    };

    for (const extraItem of this.selectedExtrasList) {
      const matched =
        (extraItem.extra.apiAddonId
          ? this.rawAddons.find((a: any) => String(a._id) === extraItem.extra.apiAddonId)
          : undefined) ||
        this.rawAddons.find(
          (a: any) =>
            String(a._id) === extraItem.extra.id ||
            norm(a.name) === norm(extraItem.extra.title),
        );
      addMappedAddon(matched, extraItem.quantity, extraItem.variant);
    }

    for (const extraDrink of extraDrinksAsAddons) {
      const matched = this.rawAddons.find((a: any) => norm(a.name) === norm(extraDrink.name));
      addMappedAddon(matched, extraDrink.quantity, extraDrink.variant);
    }

    return {
      space,
      pkg,
      startAt,
      inclusions: mappedInclusions,
      addons: mappedAddons,
      voucherCode: d.voucher.trim() || undefined,
    };
  }

  fetchQuote(): void {
    if (!this.api || typeof this.api.quoteBooking !== 'function') return;
    const target = this.resolveBackendTarget();
    if (!target) return;

    this.isQuotingSignal.set(true);
    const payload = {
      spaceId: String(target.space._id),
      packageId: String(target.pkg._id),
      startAt: target.startAt,
      hours: this.draft().hours,
      guestCount: this.draft().guests,
      inclusions: target.inclusions,
      addons: target.addons,
      voucherCode: target.voucherCode,
    };

    this.api.quoteBooking(payload).pipe(
      catchError(() => {
        if (payload.voucherCode) {
          return this.api!.quoteBooking({ ...payload, voucherCode: undefined }).pipe(
            catchError(() => of(null))
          );
        }
        return of(null);
      })
    ).subscribe((q) => {
      this.isQuotingSignal.set(false);
      if (q) {
        this.quoteSignal.set(q);
      }
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
      drinkId: 'matcha', drinkQuantities: {}, drinkVariants: {}, pastryQuantities: {}, extras: {}, extraVariants: {}, fullName: '', phone: '', email: '', note: '',
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
        drinkVariants: { ...(obj.drinkVariants || {}) },
        pastryQuantities: { ...empty.pastryQuantities, ...(obj.pastryQuantities || {}) },
        extras: { ...empty.extras, ...(obj.extras || {}) },
        extraVariants: { ...(obj.extraVariants || {}) }
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
        state.drinkVariants = {};
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
      next.drinkVariants = {};
      next.pastryQuantities = {};
      next.extras = {};
      next.extraVariants = {};
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
      (change.drinkVariants !== undefined &&
       JSON.stringify(change.drinkVariants) !== JSON.stringify(previous.drinkVariants)) ||
      (change.pastryQuantities !== undefined &&
       JSON.stringify(change.pastryQuantities) !== JSON.stringify(previous.pastryQuantities)) ||
      (change.extras !== undefined &&
       JSON.stringify(change.extras) !== JSON.stringify(previous.extras)) ||
      (change.extraVariants !== undefined &&
       JSON.stringify(change.extraVariants) !== JSON.stringify(previous.extraVariants)) ||
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
    this.fetchQuote();
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
    const target = this.resolveBackendTarget();
    if (target?.pkg?._id && this.rawPackageInclusions.length > 0) {
      const drinkInc = this.rawPackageInclusions.find(
        (inc: any) => String(inc.package_id) === String(target.pkg._id) && inc.item_type === 'STANDARD_DRINK'
      );
      if (drinkInc) {
        const minH = Number(drinkInc.min_hours_required || 0);
        if (d.hours >= minH) {
          return Number(drinkInc.quantity || 0) * (drinkInc.quantity_basis === 'PER_GUEST' ? d.guests : 1);
        }
        return 0;
      }
      return 0;
    }
    return this.requiredDrinkCountFor(d.spaceId, d.hours, d.guests);
  }
  get requiredPastryCount(): number {
    const d = this.draft();
    const target = this.resolveBackendTarget();
    if (target?.pkg?._id && this.rawPackageInclusions.length > 0) {
      const pastryInc = this.rawPackageInclusions.find(
        (inc: any) => String(inc.package_id) === String(target.pkg._id) && inc.item_type === 'PASTRY'
      );
      if (pastryInc) {
        const minH = Number(pastryInc.min_hours_required || 0);
        if (d.hours >= minH) {
          return Number(pastryInc.quantity || 0) * (pastryInc.quantity_basis === 'PER_GUEST' ? d.guests : 1);
        }
        return 0;
      }
      return 0;
    }
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
  isSizeSelectable(item: { itemCode?: string; id?: string; name?: string; title?: string } | null | undefined): boolean {
    if (!item) return false;
    const code = String(item.itemCode || '').toUpperCase();
    const name = String(item.name || item.title || item.id || '').toLowerCase();
    return code === 'MATCHA_LATTE' || code === 'HOJICHA_LATTE' || name.includes('matcha') || name.includes('hojicha');
  }

  hasTemperatureOptions(variants?: KenProductVariant[]): boolean {
    if (!Array.isArray(variants) || variants.length === 0) return false;
    const hasHot = variants.some(v => v && v.name && v.name.includes('Nóng'));
    const hasCold = variants.some(v => v && v.name && v.name.includes('Lạnh'));
    return hasHot && hasCold;
  }

  getTemperatureType(variants?: KenProductVariant[]): 'both' | 'hot' | 'cold' | 'none' {
    if (!Array.isArray(variants) || variants.length === 0) return 'none';
    const hasHot = variants.some(v => v && v.name && v.name.includes('Nóng'));
    const hasCold = variants.some(v => v && v.name && v.name.includes('Lạnh'));
    if (hasHot && hasCold) return 'both';
    if (hasHot) return 'hot';
    if (hasCold) return 'cold';
    return 'none';
  }

  parseVariant(variantName: string | undefined): { temp: KenTemperature; size: KenSize } {
    const isHot = variantName ? variantName.includes('Nóng') : false;
    const isSizeL = variantName ? (variantName.includes('L (700 ml)') || variantName.includes('Size L')) : false;
    return {
      temp: isHot ? 'Nóng' : 'Lạnh',
      size: isSizeL ? 'L' : 'M',
    };
  }

  buildVariantName(isSizeAllowed: boolean, temp: KenTemperature, size: KenSize): string {
    if (isSizeAllowed) {
      return `${temp}, ${size === 'L' ? 'L (700 ml)' : 'M (500 ml)'}`;
    }
    return temp;
  }

  formatVariantLabel(item: any, variantName: string): string {
    if (!variantName) return '';
    const parsed = this.parseVariant(variantName);
    if (this.isSizeSelectable(item)) {
      return `${parsed.temp}, Size ${parsed.size}`;
    }
    return parsed.temp;
  }

  getDrinkVariant(drinkId: string): string {
    const custom = this.draft().drinkVariants?.[drinkId];
    if (custom) return custom;
    const prod = this.drinks.find(d => d.id === drinkId);
    if (!prod) return '';
    if (this.isSizeSelectable(prod)) {
      return 'Lạnh, M (500 ml)';
    }
    const tempType = this.getTemperatureType(prod.variants);
    if (tempType === 'hot') return 'Nóng';
    if (tempType === 'cold' || tempType === 'both') return 'Lạnh';
    return prod.variants?.[0]?.name || '';
  }

  setDrinkVariant(drinkId: string, variantName: string): void {
    const drinkVariants = { ...(this.draft().drinkVariants || {}), [drinkId]: variantName };
    this.set({ drinkVariants });
  }

  setDrinkTemp(drinkId: string, temp: KenTemperature): void {
    const current = this.getDrinkVariant(drinkId);
    const parsed = this.parseVariant(current);
    const prod = this.drinks.find(d => d.id === drinkId);
    const isSize = this.isSizeSelectable(prod);
    this.setDrinkVariant(drinkId, this.buildVariantName(isSize, temp, parsed.size));
  }

  setDrinkSize(drinkId: string, size: KenSize): void {
    const current = this.getDrinkVariant(drinkId);
    const parsed = this.parseVariant(current);
    this.setDrinkVariant(drinkId, this.buildVariantName(true, parsed.temp, size));
  }

  getExtraVariant(extraId: string): string {
    const custom = this.draft().extraVariants?.[extraId];
    if (custom) return custom;
    const extra = this.extras.find(e => e.id === extraId);
    if (!extra) return '';
    if (this.isSizeSelectable(extra)) {
      return 'Lạnh, M (500 ml)';
    }
    const tempType = this.getTemperatureType(extra.variants);
    if (tempType === 'hot') return 'Nóng';
    if (tempType === 'cold' || tempType === 'both') return 'Lạnh';
    return extra.variants?.[0]?.name || '';
  }

  setExtraVariant(extraId: string, variantName: string): void {
    const extraVariants = { ...(this.draft().extraVariants || {}), [extraId]: variantName };
    this.set({ extraVariants });
  }

  setExtraTemp(extraId: string, temp: KenTemperature): void {
    const current = this.getExtraVariant(extraId);
    const parsed = this.parseVariant(current);
    const extra = this.extras.find(e => e.id === extraId);
    const isSize = this.isSizeSelectable(extra);
    this.setExtraVariant(extraId, this.buildVariantName(isSize, temp, parsed.size));
  }

  setExtraSize(extraId: string, size: KenSize): void {
    const current = this.getExtraVariant(extraId);
    const parsed = this.parseVariant(current);
    this.setExtraVariant(extraId, this.buildVariantName(true, parsed.temp, size));
  }

  getProductPrice(prod: KenProduct, variantName?: string): number {
    const vName = variantName ?? this.getDrinkVariant(prod.id);
    if (vName && Array.isArray(prod.variants) && prod.variants.length > 0) {
      const matched = prod.variants.find(v => v.name === vName);
      if (matched) return Number(matched.price);
    }
    if (this.isSizeSelectable(prod)) {
      const parsed = this.parseVariant(vName);
      return parsed.size === 'L' ? 60000 : 55000;
    }
    return Number(prod.price || 0);
  }

  getExtraPrice(extra: KenExtra, variantName?: string): number {
    const vName = variantName ?? this.getExtraVariant(extra.id);
    if (vName && Array.isArray(extra.variants) && extra.variants.length > 0) {
      const matched = extra.variants.find(v => v.name === vName);
      if (matched) return Number(matched.price);
    }
    if (this.isSizeSelectable(extra)) {
      const parsed = this.parseVariant(vName);
      return parsed.size === 'L' ? 60000 : 55000;
    }
    return Number(extra.price || 0);
  }

  get selectedDrinks(): Array<{ product: KenProduct; quantity: number; variant: string; unitPrice: number; surcharge: number; variantLabel: string }> {
    const d = this.draft();
    if (this.hasNoDrinkInclusionMenu(d.spaceId, d.hours)) return [];
    return this.drinks
      .map(product => {
        const quantity = this.drinkQuantity(product.id);
        const variant = this.getDrinkVariant(product.id);
        const unitPrice = this.getProductPrice(product, variant);
        const surcharge = Math.max(0, unitPrice - this.entitlement);
        const variantLabel = this.formatVariantLabel(product, variant);
        return { product, quantity, variant, unitPrice, surcharge, variantLabel };
      })
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
  get selectedExtrasList(): Array<{ extra: KenExtra; quantity: number; variant: string; unitPrice: number; lineTotal: number; variantLabel: string }> {
    const extrasMap = this.draft().extras || {};
    return this.extras
      .map(extra => {
        const quantity = Math.max(0, Math.min(this.maxExtraCount(extra.id), extrasMap[extra.id] || 0));
        const variant = this.getExtraVariant(extra.id);
        const unitPrice = this.getExtraPrice(extra, variant);
        const lineTotal = unitPrice * quantity;
        const variantLabel = this.formatVariantLabel(extra, variant);
        return { extra, quantity, variant, unitPrice, lineTotal, variantLabel };
      })
      .filter(item => item.quantity > 0);
  }

  get freeWaterCount(): number {
    const d = this.draft();
    const target = this.resolveBackendTarget();
    if (target?.pkg?._id && this.rawPackageInclusions.length > 0) {
      const waterInc = this.rawPackageInclusions.find(
        (inc: any) => String(inc.package_id) === String(target.pkg._id) && inc.item_type === 'WATER'
      );
      if (waterInc) {
        const minH = Number(waterInc.min_hours_required || 0);
        if (d.hours >= minH) {
          return Number(waterInc.quantity || 0) * (waterInc.quantity_basis === 'PER_GUEST' ? d.guests : 1);
        }
        return 0;
      }
      return 0;
    }
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
    const target = this.resolveBackendTarget();
    if (target?.pkg?._id && this.rawPackageInclusions.length > 0) {
      const eqIncs = this.rawPackageInclusions.filter(
        (inc: any) => String(inc.package_id) === String(target.pkg._id) && inc.item_type === 'EQUIPMENT'
      );
      if (eqIncs.length > 0) {
        return eqIncs.map((e: any) => e.label || 'Thiết bị');
      }
    }
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
    const q = this.quoteSignal();
    if (q?.packageName) return q.packageName;
    const target = this.resolveBackendTarget();
    if (target?.pkg?.name) return target.pkg.name;

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
    const target = this.resolveBackendTarget();
    if (target?.pkg?.description) return target.pkg.description;

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
    const q = this.quoteSignal();
    if (q?.pricing?.packagePrice !== undefined && q?.pricing?.packagePrice !== null) {
      return q.pricing.packagePrice;
    }
    const fixedRate = this.space.rates.find(item => item.hours === this.draft().hours)?.price;
    const price = fixedRate !== undefined
      ? fixedRate
      : (this.space.id === 'work' || this.space.id === 'focus')
        ? this.space.rates[0].price * this.draft().hours
        : 0;
    return price * (this.space.perPerson ? this.draft().guests : 1);
  }
  get entitlement(): number {
    const target = this.resolveBackendTarget();
    if (target?.pkg?._id && this.rawPackageInclusions.length > 0) {
      const drinkInc = this.rawPackageInclusions.find(
        (inc: any) => String(inc.package_id) === String(target.pkg._id) && inc.item_type === 'STANDARD_DRINK'
      );
      if (drinkInc && drinkInc.subsidy_limit !== undefined && drinkInc.subsidy_limit !== null) {
        return Number(drinkInc.subsidy_limit);
      }
    }
    return this.requiredDrinkCount > 0 ? 50000 : 0;
  }
  get drinkSurcharge(): number {
    const q = this.quoteSignal();
    if (q?.pricing?.inclusionSurcharge !== undefined && q?.pricing?.inclusionSurcharge !== null) {
      return q.pricing.inclusionSurcharge;
    }
    return this.selectedDrinks.reduce(
      (total, item) => total + item.quantity * item.surcharge,
      0
    );
  }
  get extrasTotal(): number {
    const q = this.quoteSignal();
    if (q?.pricing?.addonTotal !== undefined && q?.pricing?.addonTotal !== null) {
      return q.pricing.addonTotal;
    }
    return this.selectedExtrasList.reduce((sum, item) => sum + item.lineTotal, 0);
  }
  get subtotal(): number {
    const q = this.quoteSignal();
    if (q?.pricing?.subtotal !== undefined && q?.pricing?.subtotal !== null) {
      return q.pricing.subtotal;
    }
    return this.base + this.drinkSurcharge + this.extrasTotal;
  }
  get tierDiscount(): number {
    const q = this.quoteSignal();
    if (q?.pricing?.tierDiscount !== undefined && q?.pricing?.tierDiscount !== null) {
      return q.pricing.tierDiscount;
    }
    return Math.round(this.subtotal * this.currentTierRate);
  }
  get silverDiscount(): number {
    return this.tierDiscount;
  }
  get voucherDiscount(): number {
    return this.quoteSignal()?.pricing?.voucherDiscount ?? 0;
  }
  get currentTierCode(): string {
    return this.quoteSignal()?.tierCode ?? ((this.auth?.user as any)?.membershipTier ?? (this.auth?.user as any)?.tier ?? (this.auth?.user as any)?.tier_code ?? 'BASIC');
  }
  get currentTierRate(): number {
    const qRate = this.quoteSignal()?.tierRate;
    if (qRate !== undefined && qRate !== null) {
      return Number(qRate);
    }
    const user = this.auth?.user as any;
    if (!user) return 0;
    const tier = user.membershipTier || user.tier || user.tier_code;
    if (tier === 'DIAMOND') return 0.15;
    if (tier === 'GOLD') return 0.10;
    if (tier === 'SILVER') return 0.05;
    return 0;
  }
  get tierDiscountLabel(): string {
    const rate = this.currentTierRate;
    const pct = Math.round(rate * 100);
    return pct > 0 ? `Ưu đãi thành viên (${pct}%)` : 'Ưu đãi thành viên';
  }
  get total(): number {
    const q = this.quoteSignal();
    if (q?.pricing?.finalAmount !== undefined && q?.pricing?.finalAmount !== null) {
      return q.pricing.finalAmount;
    }
    return this.subtotal - this.silverDiscount - this.voucherDiscount;
  }
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
    if (!file) return '/images/addons/cf-den.png';
    if (file.startsWith('/') || file.startsWith('http') || file.startsWith('data:')) return file;
    if (file.startsWith('listing-')) return '/images/ken-flow/' + file;
    return '/images/addons/' + file;
  }
}
