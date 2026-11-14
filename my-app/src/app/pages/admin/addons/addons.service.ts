import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, forkJoin, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

export type ProductCategory = 'Đồ uống' | 'Bánh / Ăn nhẹ' | 'Tiện ích';
export type AddonAvailability = 'Khả dụng' | 'Hết hàng' | 'Không khả dụng';
export type ProductStatus = 'ACTIVE' | 'PAUSED';

export interface ProductAddon {
  id: string;
  code: string;
  source: 'PRODUCT' | 'ADDON';
  linkedProductId?: string;
  linkedAddonId?: string;
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
    code: 'DU-01',
    source: 'PRODUCT',
    name: 'Cà phê đen / sữa',
    category: 'Đồ uống',
    price: 40000,
    unit: 'Ly',
    catalogVisible: true,
    addonAvailable: 'Khả dụng',
    status: 'ACTIVE',
    image: '/images/figma/dish-ca-phe-den-sua.png',
    packageLink: { packageName: 'Hỗ trợ chuẩn gói Focus / Lounge', packageSupport: 50000 },
  },
  {
    id: 'DU-02',
    code: 'DU-02',
    source: 'PRODUCT',
    name: 'Americano',
    category: 'Đồ uống',
    price: 40000,
    unit: 'Ly',
    catalogVisible: true,
    addonAvailable: 'Khả dụng',
    status: 'ACTIVE',
    image: '/images/figma/dish-americano.png',
    packageLink: { packageName: 'Hỗ trợ chuẩn gói Focus / Lounge', packageSupport: 50000 },
  },
  {
    id: 'DU-03',
    code: 'DU-03',
    source: 'PRODUCT',
    name: 'Bạc Xỉu',
    category: 'Đồ uống',
    price: 45000,
    unit: 'Ly',
    catalogVisible: true,
    addonAvailable: 'Khả dụng',
    status: 'ACTIVE',
    image: '/images/figma/dish-bac-xiu.png',
    packageLink: { packageName: 'Hỗ trợ chuẩn gói Focus / Lounge', packageSupport: 50000 },
  },
  {
    id: 'DU-06',
    code: 'DU-06',
    source: 'PRODUCT',
    name: 'Matcha Latte',
    category: 'Đồ uống',
    price: 55000,
    unit: 'Ly',
    catalogVisible: true,
    addonAvailable: 'Khả dụng',
    status: 'ACTIVE',
    image: '/images/figma/popup-matcha.png',
    packageLink: { packageName: 'Trong gói Focus Pod', packageSupport: 50000 },
  },
  {
    id: 'BN-01',
    code: 'BN-01',
    source: 'ADDON',
    name: 'Croissant Bơ Pháp',
    category: 'Bánh / Ăn nhẹ',
    price: 42000,
    unit: 'Phần',
    catalogVisible: true,
    addonAvailable: 'Khả dụng',
    status: 'ACTIVE',
    image: '/images/figma/dish-croissant.png',
  },
  {
    id: 'TI-01',
    code: 'TI-01',
    source: 'ADDON',
    name: 'Bộ cáp sạc đa năng',
    category: 'Tiện ích',
    price: 20000,
    unit: 'Lượt',
    catalogVisible: false,
    addonAvailable: 'Khả dụng',
    status: 'ACTIVE',
    image: '/images/figma/monitor.svg',
  },
];

@Injectable({ providedIn: 'root' })
export class AddonsService {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly addonsSubject = new BehaviorSubject<ProductAddon[]>(this.loadInitial());
  readonly addons$ = this.addonsSubject.asObservable();

  get addons(): ProductAddon[] {
    return this.addonsSubject.value;
  }

  loadFromApi(): Observable<ProductAddon[]> {
    if (!this.http) return of(this.addons);
    return forkJoin({
      products: this.http.get<any>('/api/products?all=true').pipe(catchError(() => of(null))),
      addons: this.http.get<any>('/api/addons?all=true').pipe(catchError(() => of(null))),
    }).pipe(
      map((res) => {
        const rawProducts = this.extractList(res.products);
        const rawAddons = this.extractList(res.addons);
        if (rawProducts.length === 0 && rawAddons.length === 0 && res.products === null && res.addons === null) {
          return this.addons;
        }

        const addonByProductId = new Map<string, any>();
        for (const a of rawAddons) {
          if (a.product_id) addonByProductId.set(String(a.product_id), a);
        }

        const result: ProductAddon[] = [];
        const seenAddonIds = new Set<string>();

        for (const p of rawProducts) {
          const pId = String(p._id || p.id);
          const linkedAddon = addonByProductId.get(pId);
          if (linkedAddon?._id) seenAddonIds.add(String(linkedAddon._id));
          result.push(this.mapRawItem(p, 'PRODUCT', linkedAddon));
        }

        for (const a of rawAddons) {
          const aId = String(a._id || a.id);
          if (seenAddonIds.has(aId)) continue;
          result.push(this.mapRawItem(a, 'ADDON', a));
        }

        this.update(result);
        return result;
      })
    );
  }

  private extractList(payload: any): any[] {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    return payload.items || payload.data || [];
  }

  private mapRawItem(raw: any, source: 'PRODUCT' | 'ADDON', linkedAddon?: any): ProductAddon {
    const id = String(raw._id || raw.id);
    const cat = this.resolveCategory(raw.category || raw.type);
    const isActive = raw.is_active !== false && String(raw.status || 'ACTIVE').toUpperCase() !== 'PAUSED' && String(raw.status || 'ACTIVE').toUpperCase() !== 'INACTIVE';

    let avail: AddonAvailability = 'Khả dụng';
    if (linkedAddon) {
      if (linkedAddon.in_stock === false || linkedAddon.is_out_of_stock === true) avail = 'Hết hàng';
      else if (linkedAddon.is_active === false) avail = 'Không khả dụng';
    } else if (raw.addon_available === false) {
      avail = 'Không khả dụng';
    }

    const imgRaw = raw.image_url || raw.image || '';
    const img = imgRaw && !imgRaw.startsWith('/') && !imgRaw.startsWith('http') ? `/${imgRaw}` : (imgRaw || this.defaultImage(cat));

    return {
      id,
      code: raw.code || raw.item_code || raw.addon_code || id.slice(-6).toUpperCase(),
      source,
      linkedProductId: source === 'PRODUCT' ? id : (raw.product_id ? String(raw.product_id) : undefined),
      linkedAddonId: linkedAddon?._id ? String(linkedAddon._id) : (source === 'ADDON' ? id : undefined),
      name: raw.name || raw.product_name || raw.addon_name || 'Sản phẩm KÉN',
      category: cat,
      price: Number(raw.price ?? raw.unit_price ?? raw.base_price ?? 0),
      unit: raw.unit || (cat === 'Đồ uống' ? 'Ly' : cat === 'Tiện ích' ? 'Lượt' : 'Phần'),
      catalogVisible: raw.catalog_visible !== undefined ? Boolean(raw.catalog_visible) : source === 'PRODUCT',
      addonAvailable: avail,
      status: isActive ? 'ACTIVE' : 'PAUSED',
      image: img,
      packageLink:
        cat === 'Đồ uống'
          ? { packageName: 'Chuẩn gói Focus / Lounge (Hỗ trợ 50.000đ)', packageSupport: 50000 }
          : undefined,
    };
  }

  private resolveCategory(raw: any): ProductCategory {
    const val = String(raw || '').toUpperCase();
    if (val.includes('UTILITY') || val.includes('EQUIPMENT') || val.includes('TIỆN ÍCH') || val.includes('TIEN_ICH')) {
      return 'Tiện ích';
    }
    if (val.includes('PASTRY') || val.includes('FOOD') || val.includes('SNACK') || val.includes('BÁNH')) {
      return 'Bánh / Ăn nhẹ';
    }
    return 'Đồ uống';
  }

  private toApiCategory(cat: ProductCategory): string {
    if (cat === 'Tiện ích') return 'UTILITY';
    if (cat === 'Bánh / Ăn nhẹ') return 'PASTRY';
    return 'DRINK';
  }

  private defaultImage(cat: ProductCategory): string {
    if (cat === 'Đồ uống') return '/images/figma/dish-ca-phe-den-sua.png';
    if (cat === 'Bánh / Ăn nhẹ') return '/images/figma/dish-croissant.png';
    return '/images/figma/monitor.svg';
  }

  findById(id: string): ProductAddon | undefined {
    return this.addonsSubject.value.find((item) => item.id === id);
  }

  saveApi(data: Omit<ProductAddon, 'id' | 'source'>, existing?: ProductAddon): Observable<ProductAddon> {
    if (!this.http || (existing && !/^[a-f0-9]{24}$/i.test(existing.id))) {
      return of(this.save({ ...data, source: existing?.source || 'PRODUCT' }, existing?.id));
    }

    const isActive = data.status === 'ACTIVE';
    const apiPayload: Record<string, any> = {
      code: data.code || undefined,
      name: data.name,
      category: this.toApiCategory(data.category),
      type: this.toApiCategory(data.category),
      price: Number(data.price),
      unit: data.unit,
      image_url: data.image,
      catalog_visible: data.catalogVisible,
      in_stock: data.addonAvailable !== 'Hết hàng',
      is_active: isActive,
      status: isActive ? 'ACTIVE' : 'INACTIVE',
    };

    if (existing) {
      const targetEndpoint =
        existing.source === 'ADDON'
          ? `/api/addons/${existing.id}`
          : `/api/products/${existing.id}`;
      return this.http.patch<any>(targetEndpoint, apiPayload).pipe(
        map((res) => {
          const doc = res?.item || res?.product || res?.addon || res;
          return doc?._id ? this.mapRawItem(doc, existing.source) : this.save({ ...data, source: existing.source }, existing.id);
        }),
        tap(() => {
          this.loadFromApi().subscribe();
        })
      );
    }

    const createEndpoint = data.category === 'Tiện ích' ? '/api/addons' : '/api/products';
    const src: 'PRODUCT' | 'ADDON' = data.category === 'Tiện ích' ? 'ADDON' : 'PRODUCT';
    return this.http.post<any>(createEndpoint, apiPayload).pipe(
      map((res) => {
        const doc = res?.item || res?.product || res?.addon || res;
        return doc?._id ? this.mapRawItem(doc, src) : this.save({ ...data, source: src });
      }),
      tap(() => {
        this.loadFromApi().subscribe();
      })
    );
  }

  toggleStatusApi(product: ProductAddon): Observable<any> {
    const nextActive = product.status !== 'ACTIVE';
    if (!this.http || !/^[a-f0-9]{24}$/i.test(product.id)) {
      this.toggleStatus(product.id);
      return of({ status: nextActive ? 'ACTIVE' : 'PAUSED' });
    }
    const base = product.source === 'ADDON' ? `/api/addons/${product.id}` : `/api/products/${product.id}`;
    const req$ = nextActive
      ? this.http.patch<any>(base, { is_active: true, status: 'ACTIVE' })
      : this.http.delete<any>(base);

    return req$.pipe(
      tap(() => {
        this.loadFromApi().subscribe();
      })
    );
  }

  save(data: Omit<ProductAddon, 'id'>, id?: string): ProductAddon {
    const items = this.addonsSubject.value;
    const saved: ProductAddon = {
      ...data,
      id: id ?? data.code ?? this.generateNextId(data.category),
    };
    const next = id ? items.map((item) => (item.id === id ? saved : item)) : [...items, saved];
    this.update(next);
    return saved;
  }

  toggleStatus(id: string): void {
    const next = this.addonsSubject.value.map((item) =>
      item.id === id
        ? { ...item, status: (item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE') as ProductStatus }
        : item
    );
    this.update(next);
  }

  private generateNextId(category: ProductCategory): string {
    const prefix = category === 'Đồ uống' ? 'DU' : category === 'Bánh / Ăn nhẹ' ? 'BN' : 'TI';
    const nums = this.addonsSubject.value
      .filter((i) => i.code.startsWith(prefix))
      .map((i) => Number(i.code.replace(`${prefix}-`, '')))
      .filter(Number.isFinite);
    const next = Math.max(0, ...nums) + 1;
    return `${prefix}-${String(next).padStart(2, '0')}`;
  }

  private update(items: ProductAddon[]): void {
    this.addonsSubject.next(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore
    }
  }

  private loadInitial(): ProductAddon[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return INITIAL_ADDONS;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_ADDONS;
    } catch {
      return INITIAL_ADDONS;
    }
  }
}
