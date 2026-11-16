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

const INITIAL_ADDONS: ProductAddon[] = [];

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
        if (
          rawProducts.length === 0 &&
          rawAddons.length === 0 &&
          res.products === null &&
          res.addons === null
        ) {
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
      }),
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
    const isActive =
      raw.is_active !== false &&
      String(raw.status || 'ACTIVE').toUpperCase() !== 'PAUSED' &&
      String(raw.status || 'ACTIVE').toUpperCase() !== 'INACTIVE';

    let avail: AddonAvailability = 'Khả dụng';
    if (linkedAddon) {
      if (linkedAddon.in_stock === false || linkedAddon.is_out_of_stock === true)
        avail = 'Hết hàng';
      else if (linkedAddon.is_active === false) avail = 'Không khả dụng';
    } else if (raw.addon_available === false) {
      avail = 'Không khả dụng';
    }

    const img = this.resolveProductImage(raw, cat);

    return {
      id,
      code: raw.code || raw.item_code || raw.addon_code || id.slice(-6).toUpperCase(),
      source,
      linkedProductId:
        source === 'PRODUCT' ? id : raw.product_id ? String(raw.product_id) : undefined,
      linkedAddonId: linkedAddon?._id
        ? String(linkedAddon._id)
        : source === 'ADDON'
          ? id
          : undefined,
      name: raw.name || raw.product_name || raw.addon_name || 'Sản phẩm KÉN',
      category: cat,
      price: Number(raw.price ?? raw.unit_price ?? raw.base_price ?? 0),
      unit: raw.unit || (cat === 'Đồ uống' ? 'Ly' : cat === 'Tiện ích' ? 'Lượt' : 'Phần'),
      catalogVisible:
        raw.catalog_visible !== undefined ? Boolean(raw.catalog_visible) : source === 'PRODUCT',
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
    if (
      val.includes('UTILITY') ||
      val.includes('EQUIPMENT') ||
      val.includes('TIỆN ÍCH') ||
      val.includes('TIEN_ICH')
    ) {
      return 'Tiện ích';
    }
    if (
      val.includes('PASTRY') ||
      val.includes('FOOD') ||
      val.includes('SNACK') ||
      val.includes('BÁNH')
    ) {
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
    if (cat === 'Đồ uống') return '/images/addons/cf-den.png';
    if (cat === 'Bánh / Ăn nhẹ') return '/images/addons/bake-croissant.png';
    return '/images/addons/eq-monitor.png';
  }

  findById(id: string): ProductAddon | undefined {
    return this.addonsSubject.value.find((item) => item.id === id);
  }

  saveApi(
    data: Omit<ProductAddon, 'id' | 'source'>,
    existing?: ProductAddon,
  ): Observable<ProductAddon> {
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
        existing.source === 'ADDON' ? `/api/addons/${existing.id}` : `/api/products/${existing.id}`;
      return this.http.patch<any>(targetEndpoint, apiPayload).pipe(
        map((res) => {
          const doc = res?.item || res?.product || res?.addon || res;
          return doc?._id
            ? this.mapRawItem(doc, existing.source)
            : this.save({ ...data, source: existing.source }, existing.id);
        }),
        tap(() => {
          this.loadFromApi().subscribe();
        }),
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
      }),
    );
  }

  toggleStatusApi(product: ProductAddon): Observable<any> {
    const nextActive = product.status !== 'ACTIVE';
    if (!this.http || !/^[a-f0-9]{24}$/i.test(product.id)) {
      this.toggleStatus(product.id);
      return of({ status: nextActive ? 'ACTIVE' : 'PAUSED' });
    }
    const base =
      product.source === 'ADDON' ? `/api/addons/${product.id}` : `/api/products/${product.id}`;
    const req$ = nextActive
      ? this.http.patch<any>(base, { is_active: true, status: 'ACTIVE' })
      : this.http.delete<any>(base);

    return req$.pipe(
      tap(() => {
        this.loadFromApi().subscribe();
      }),
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
        : item,
    );
    this.update(next);
  }

  private resolveProductImage(raw: any, cat: ProductCategory): string {
    const imgRaw = typeof (raw?.image_url || raw?.image) === 'string' ? String(raw.image_url || raw.image).trim() : '';
    if (imgRaw.startsWith('/images/addons/') || imgRaw.startsWith('http') || imgRaw.startsWith('data:')) {
      return imgRaw;
    }
    const code = String(raw?.item_code || raw?.code || '').toUpperCase();
    const name = String(raw?.name || raw?.product_name || raw?.addon_name || '').toLocaleLowerCase('vi-VN');
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
    if (code.startsWith('TEA_') || name.includes('trà') || name.includes('oolong')) return '/images/addons/tea-oolong-macchiato.png';
    if (code.includes('MATCHA') && cat !== 'Bánh / Ăn nhẹ' && !name.includes('mousse')) return '/images/addons/matcha-latte.png';
    if (code.includes('HOJICHA') || name.includes('hojicha')) return '/images/addons/hojicha-latte.png';
    if (code === 'CHOC_NONG' || name.includes('sô-cô-la')) return '/images/addons/choc-nong.png';
    if (code === 'WATER_BOTTLE' || name.includes('tinh khiết') || name.includes('nước suối')) return '/images/addons/water-bottle.png';
    if (code === 'JUICE_CHANH_DAY' || (name.includes('chanh dây') && !name.includes('mousse'))) return '/images/addons/juice-chanh-day.png';
    if (code.startsWith('JUICE_') || name.includes('nước cam') || name.includes('nước ép')) return '/images/addons/juice-cam.png';
    if (code.startsWith('SODA_') || name.includes('soda')) return '/images/addons/soda-trai-cay.png';
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
    return this.defaultImage(cat);
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
  }

  private loadInitial(): ProductAddon[] {
    return [];
  }
}
