import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ProductCategory = 'Đồ uống' | 'Bánh / Ăn nhẹ' | 'Tiện ích';
export type AddonAvailability = 'Khả dụng' | 'Hết hàng' | 'Không khả dụng';
export type ProductStatus = 'ACTIVE' | 'PAUSED';

export interface ProductAddon {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  unit: string;
  catalogVisible: boolean;
  addonAvailable: AddonAvailability;
  status: ProductStatus;
  image: string;
  packageLink?: {
    packageName: string;
    packageSupport: number;
  };
}

const STORAGE_KEY = 'ken-admin-addons-v1';

const INITIAL_ADDONS: ProductAddon[] = [
  {
    id: 'DU-01',
    name: 'Cà phê đen / sữa',
    category: 'Đồ uống',
    price: 40000,
    unit: 'Ly',
    catalogVisible: true,
    addonAvailable: 'Khả dụng',
    status: 'ACTIVE',
    image: 'images/figma/dish-ca-phe-den-sua.png',
  },
  {
    id: 'DU-02',
    name: 'Americano',
    category: 'Đồ uống',
    price: 40000,
    unit: 'Ly',
    catalogVisible: true,
    addonAvailable: 'Khả dụng',
    status: 'ACTIVE',
    image: 'images/figma/dish-americano.png',
  },
  {
    id: 'DU-03',
    name: 'Bạc Xỉu',
    category: 'Đồ uống',
    price: 45000,
    unit: 'Ly',
    catalogVisible: true,
    addonAvailable: 'Khả dụng',
    status: 'ACTIVE',
    image: 'images/figma/dish-bac-xiu.png',
  },
  {
    id: 'DU-04',
    name: 'Cold Brew',
    category: 'Đồ uống',
    price: 50000,
    unit: 'Ly',
    catalogVisible: true,
    addonAvailable: 'Khả dụng',
    status: 'ACTIVE',
    image: 'images/figma/dish-cold-brew.png',
  },
  {
    id: 'DU-05',
    name: 'Trà Đào',
    category: 'Đồ uống',
    price: 50000,
    unit: 'Ly',
    catalogVisible: true,
    addonAvailable: 'Khả dụng',
    status: 'ACTIVE',
    image: 'images/figma/dish-nuoc-cam.png',
  },
  {
    id: 'DU-06',
    name: 'Matcha Latte',
    category: 'Đồ uống',
    price: 55000,
    unit: 'Ly',
    catalogVisible: true,
    addonAvailable: 'Khả dụng',
    status: 'ACTIVE',
    image: 'images/figma/popup-matcha.png',
    packageLink: {
      packageName: 'Trong gói Focus Pod',
      packageSupport: 50000,
    },
  },
  {
    id: 'DU-07',
    name: 'Hojicha',
    category: 'Đồ uống',
    price: 55000,
    unit: 'Ly',
    catalogVisible: true,
    addonAvailable: 'Khả dụng',
    status: 'ACTIVE',
    image: 'images/figma/dish-matcha-hojicha.png',
    packageLink: {
      packageName: 'Trong gói Focus Pod',
      packageSupport: 50000,
    },
  },
  {
    id: 'DU-08',
    name: 'Nước chai',
    category: 'Đồ uống',
    price: 15000,
    unit: 'Chai',
    catalogVisible: true,
    addonAvailable: 'Khả dụng',
    status: 'ACTIVE',
    image: 'images/figma/dish-soda.png',
  },
  {
    id: 'BN-01',
    name: 'Croissant',
    category: 'Bánh / Ăn nhẹ',
    price: 35000,
    unit: 'Phần',
    catalogVisible: true,
    addonAvailable: 'Khả dụng',
    status: 'ACTIVE',
    image: 'images/figma/dish-croissant.png',
  },
  {
    id: 'BN-02',
    name: 'Mousse',
    category: 'Bánh / Ăn nhẹ',
    price: 45000,
    unit: 'Phần',
    catalogVisible: true,
    addonAvailable: 'Hết hàng',
    status: 'ACTIVE',
    image: 'images/figma/dish-mousse.png',
  },
  {
    id: 'BN-03',
    name: 'Tiramisu',
    category: 'Bánh / Ăn nhẹ',
    price: 50000,
    unit: 'Phần',
    catalogVisible: true,
    addonAvailable: 'Khả dụng',
    status: 'ACTIVE',
    image: 'images/figma/dish-tiramisu.png',
  },
  {
    id: 'TI-01',
    name: 'Màn hình 24 inch',
    category: 'Tiện ích',
    price: 50000,
    unit: 'Giờ',
    catalogVisible: false,
    addonAvailable: 'Khả dụng',
    status: 'ACTIVE',
    image: 'images/figma/monitor.svg',
  },
  {
    id: 'TI-02',
    name: 'Bàn phím + chuột',
    category: 'Tiện ích',
    price: 30000,
    unit: 'Lượt',
    catalogVisible: false,
    addonAvailable: 'Khả dụng',
    status: 'ACTIVE',
    image: 'images/admin/nav-table.svg',
  },
  {
    id: 'TI-03',
    name: 'Cáp + sạc',
    category: 'Tiện ích',
    price: 20000,
    unit: 'Lượt',
    catalogVisible: false,
    addonAvailable: 'Không khả dụng',
    status: 'PAUSED',
    image: 'images/figma/smartphone.svg',
  },
];

@Injectable({ providedIn: 'root' })
export class AddonsService {
  private readonly addonsSubject = new BehaviorSubject<ProductAddon[]>(this.loadAddons());
  readonly addons$ = this.addonsSubject.asObservable();

  get addons(): ProductAddon[] {
    return this.addonsSubject.value;
  }

  findById(id: string): ProductAddon | undefined {
    return this.addons.find((item) => item.id === id);
  }

  save(product: Omit<ProductAddon, 'id'>, id?: string): ProductAddon {
    const list = this.addons;
    const saved: ProductAddon = {
      ...product,
      id: id ?? this.generateNextId(product.category),
    };
    const next = id
      ? list.map((item) => (item.id === id ? saved : item))
      : [...list, saved];
    this.update(next);
    return saved;
  }

  toggleStatus(id: string): void {
    const next = this.addons.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          status: (item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE') as ProductStatus,
        };
      }
      return item;
    });
    this.update(next);
  }

  delete(id: string): void {
    this.update(this.addons.filter((item) => item.id !== id));
  }

  resetToDefault(): void {
    this.update(INITIAL_ADDONS);
  }

  private update(items: ProductAddon[]): void {
    this.addonsSubject.next(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore if localStorage unavailable
    }
  }

  private loadAddons(): ProductAddon[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return INITIAL_ADDONS;
      const parsed = JSON.parse(stored) as unknown;
      return Array.isArray(parsed) && parsed.length > 0 ? (parsed as ProductAddon[]) : INITIAL_ADDONS;
    } catch {
      return INITIAL_ADDONS;
    }
  }

  private generateNextId(category: ProductCategory): string {
    let prefix = 'DU';
    if (category === 'Bánh / Ăn nhẹ') prefix = 'BN';
    else if (category === 'Tiện ích') prefix = 'TI';

    const nums = this.addons
      .filter((i) => i.id.startsWith(prefix))
      .map((i) => Number(i.id.replace(prefix + '-', '')))
      .filter(Number.isFinite);

    const nextNum = Math.max(0, ...nums) + 1;
    return `${prefix}-${String(nextNum).padStart(2, '0')}`;
  }
}
