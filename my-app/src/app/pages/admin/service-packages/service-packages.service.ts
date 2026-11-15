import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, forkJoin, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

export type PackageType = 'FIXED' | 'HOURLY';
export type PackageUnit = 'PER_SPACE' | 'PER_PERSON';
export type PackageStatus = 'ACTIVE' | 'INACTIVE';

export interface ServicePackage {
  id: string;
  code?: string;
  name: string;
  shortName: string;
  group: 'KÉN Tập Trung' | 'KÉN Tái Tạo';
  type: PackageType;
  unit: PackageUnit;
  duration: string;
  durationMinutes?: number;
  price: number;
  space: string;
  inclusion: string;
  status: PackageStatus;
  spaceId?: string;
}

const STORAGE_KEY = 'ken-admin-service-packages-v2';

const INITIAL_PACKAGES: ServicePackage[] = [
  {
    id: 'WL-01',
    name: 'Gói Linh hoạt',
    shortName: 'Work Lounge',
    group: 'KÉN Tập Trung',
    type: 'HOURLY',
    unit: 'PER_PERSON',
    duration: 'Từ 1 giờ',
    durationMinutes: 60,
    price: 30000,
    space: 'Work Lounge',
    spaceId: 's1',
    inclusion: '01 đồ uống · Dùng không gian Work Lounge',
    status: 'ACTIVE',
  },
  {
    id: 'WL-02',
    name: 'Gói Nửa ngày',
    shortName: 'Work Lounge',
    group: 'KÉN Tập Trung',
    type: 'FIXED',
    unit: 'PER_PERSON',
    duration: '4 giờ',
    durationMinutes: 240,
    price: 90000,
    space: 'Work Lounge',
    spaceId: 's1',
    inclusion: '01 đồ uống · Dùng không gian Work Lounge',
    status: 'ACTIVE',
  },
  {
    id: 'WL-03',
    name: 'Gói Cả ngày',
    shortName: 'Work Lounge',
    group: 'KÉN Tập Trung',
    type: 'FIXED',
    unit: 'PER_PERSON',
    duration: '08:00–22:00',
    durationMinutes: 840,
    price: 150000,
    space: 'Work Lounge',
    spaceId: 's1',
    inclusion: '01 đồ uống · Dùng không gian Work Lounge',
    status: 'ACTIVE',
  },
  {
    id: 'FP-01',
    name: 'Tập trung theo giờ',
    shortName: 'Focus Pod',
    group: 'KÉN Tập Trung',
    type: 'HOURLY',
    unit: 'PER_SPACE',
    duration: 'Từ 1 giờ',
    durationMinutes: 60,
    price: 45000,
    space: 'Focus Pod',
    spaceId: 's2',
    inclusion: '01 đồ uống · Hỗ trợ tối đa 50.000đ',
    status: 'ACTIVE',
  },
  {
    id: 'FP-02',
    name: 'Tập trung nửa ngày',
    shortName: 'Focus Pod',
    group: 'KÉN Tập Trung',
    type: 'FIXED',
    unit: 'PER_SPACE',
    duration: '4 giờ',
    durationMinutes: 240,
    price: 140000,
    space: 'Focus Pod',
    spaceId: 's2',
    inclusion: '01 đồ uống · Hỗ trợ tối đa 50.000đ',
    status: 'ACTIVE',
  },
  {
    id: 'MR-01',
    name: 'Họp nhóm nhỏ',
    shortName: 'Small Meeting Room',
    group: 'KÉN Tập Trung',
    type: 'FIXED',
    unit: 'PER_SPACE',
    duration: '3 giờ',
    durationMinutes: 180,
    price: 250000,
    space: 'Small Meeting Room',
    spaceId: 's3',
    inclusion: 'Máy chiếu + bảng từ · Mỗi khách 01 chai nước suối',
    status: 'ACTIVE',
  },
  {
    id: 'BR-01',
    name: 'Họp nhóm lớn',
    shortName: 'Boardroom',
    group: 'KÉN Tập Trung',
    type: 'FIXED',
    unit: 'PER_SPACE',
    duration: '3 giờ',
    durationMinutes: 180,
    price: 450000,
    space: 'Boardroom',
    spaceId: 's4',
    inclusion: 'Máy chiếu + bảng từ · Mỗi khách 01 chai nước suối',
    status: 'ACTIVE',
  },
  {
    id: 'TT-01',
    name: 'Nghỉ nhanh',
    shortName: 'Single / Double / Studio',
    group: 'KÉN Tái Tạo',
    type: 'FIXED',
    unit: 'PER_SPACE',
    duration: '1 giờ',
    durationMinutes: 60,
    price: 70000,
    space: 'Single / Double / Studio',
    spaceId: 's5',
    inclusion: 'Single 70.000đ · Double 100.000đ · Studio 150.000đ',
    status: 'ACTIVE',
  },
  {
    id: 'TT-02',
    name: 'Ngả lưng',
    shortName: 'Single / Double / Studio',
    group: 'KÉN Tái Tạo',
    type: 'FIXED',
    unit: 'PER_SPACE',
    duration: '2 giờ',
    durationMinutes: 120,
    price: 130000,
    space: 'Single / Double / Studio',
    spaceId: 's6',
    inclusion: 'Single 130.000đ · Double 180.000đ · Studio 290.000đ',
    status: 'ACTIVE',
  },
  {
    id: 'TT-03',
    name: 'Trú ẩn',
    shortName: 'Single / Double / Studio',
    group: 'KÉN Tái Tạo',
    type: 'FIXED',
    unit: 'PER_SPACE',
    duration: '4 giờ',
    durationMinutes: 240,
    price: 220000,
    space: 'Single / Double / Studio',
    spaceId: 's7',
    inclusion: 'Single 220.000đ · Double 310.000đ · Studio 480.000đ',
    status: 'ACTIVE',
  },
  {
    id: 'TT-04',
    name: 'Nguyên ngày',
    shortName: 'Single / Double / Studio',
    group: 'KÉN Tái Tạo',
    type: 'FIXED',
    unit: 'PER_SPACE',
    duration: '8 giờ',
    durationMinutes: 480,
    price: 350000,
    space: 'Single / Double / Studio',
    spaceId: 's5',
    inclusion: 'Single 350.000đ · Double 490.000đ · Studio 770.000đ',
    status: 'ACTIVE',
  },
];

@Injectable({ providedIn: 'root' })
export class ServicePackagesService {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly packagesSubject = new BehaviorSubject<ServicePackage[]>(this.loadPackages());
  readonly packages$ = this.packagesSubject.asObservable();

  private spaceLookup = new Map<string, { name: string; zoneName: string; type: string }>();

  get packages(): ServicePackage[] {
    return this.packagesSubject.value;
  }

  loadFromApi(): Observable<ServicePackage[]> {
    if (!this.http) return of(this.packages);
    return forkJoin({
      packages: this.http.get<any>('/api/packages?all=true').pipe(catchError(() => of(null))),
      spaces: this.http.get<any>('/api/spaces?all=true').pipe(catchError(() => of(null))),
      zones: this.http.get<any>('/api/zones?all=true').pipe(catchError(() => of(null))),
      pricing: this.http.get<any>('/api/pricing').pipe(catchError(() => of(null))),
    }).pipe(
      map((res) => {
        const rawZones = this.extractList(res.zones);
        const zoneById = new Map<string, string>();
        for (const z of rawZones) {
          zoneById.set(String(z._id || z.id), z.name || z.code || 'KÉN Tập Trung');
        }

        const rawSpaces = this.extractList(res.spaces);
        this.spaceLookup.clear();
        for (const s of rawSpaces) {
          const zName = zoneById.get(String(s.zone_id || '')) || s.zone_name || 'KÉN Tập Trung';
          this.spaceLookup.set(String(s._id || s.id), {
            name: s.name_en || s.name || 'Không gian',
            zoneName: zName,
            type: String(s.type || s.booking_mode || 'EXCLUSIVE').toUpperCase(),
          });
        }

        const rawPricing = this.extractList(res.pricing);
        const priceByPkgSpace = new Map<string, number>();
        for (const pr of rawPricing) {
          const pid = String(pr.package_id || '');
          if (pid && pr.price != null && !priceByPkgSpace.has(pid)) {
            priceByPkgSpace.set(pid, Number(pr.price));
          }
        }

        const rawPackages = this.extractList(res.packages);
        if (rawPackages.length === 0 && res.packages === null) {
          return this.packages;
        }

        const mapped = rawPackages.map((p: any) => this.mapApiPackage(p, priceByPkgSpace));
        this.update(mapped);
        return mapped;
      })
    );
  }

  private extractList(payload: any): any[] {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    return payload.items || payload.data || [];
  }

  private mapApiPackage(p: any, priceByPkg: Map<string, number>): ServicePackage {
    const id = String(p._id || p.id);
    const spId = p.space_id ? String(p.space_id) : undefined;
    const spRef = spId ? this.spaceLookup.get(spId) : undefined;

    const rawGroup = String(spRef?.zoneName || p.zone_name || p.group || '').includes('Tái Tạo')
      ? 'KÉN Tái Tạo'
      : 'KÉN Tập Trung';

    const rawType = String(p.pricing_type || p.type || 'FIXED').toUpperCase();
    const pkgType: PackageType = rawType === 'HOURLY' ? 'HOURLY' : 'FIXED';
    const rawUnit = String(p.unit || (spRef?.type === 'SHARED' ? 'PER_PERSON' : 'PER_SPACE')).toUpperCase();
    const pkgUnit: PackageUnit = rawUnit === 'PER_PERSON' ? 'PER_PERSON' : 'PER_SPACE';

    const mins = Number(p.duration_minutes ?? 60);
    const hours = mins >= 60 ? Math.round((mins / 60) * 10) / 10 : mins;
    const duration =
      p.duration_label ||
      (mins >= 60 ? `${hours} giờ` : `${mins} phút`);

    const price = Number(p.price ?? p.base_price ?? priceByPkg.get(id) ?? 0);
    const isActive = p.is_active !== false && String(p.status || 'ACTIVE').toUpperCase() === 'ACTIVE';

    return {
      id,
      code: p.code || id.slice(-6).toUpperCase(),
      name: p.name || 'Gói dịch vụ',
      shortName: spRef?.name || p.space_name || p.short_name || 'Không gian KÉN',
      group: rawGroup,
      type: pkgType,
      unit: pkgUnit,
      duration,
      durationMinutes: mins,
      price,
      space: spRef?.name || p.space_name || 'Work Lounge',
      spaceId: spId,
      inclusion: p.description || p.inclusion || '01 đồ uống chuẩn gói (hỗ trợ tối đa 50.000đ)',
      status: isActive ? 'ACTIVE' : 'INACTIVE',
    };
  }

  findById(id: string): ServicePackage | undefined {
    return this.packagesSubject.value.find((item) => item.id === id);
  }

  savePackageApi(data: Omit<ServicePackage, 'id'>, id?: string): Observable<ServicePackage> {
    if (!this.http || (id && !/^[a-f0-9]{24}$/i.test(id))) {
      return of(this.save(data, id));
    }

    const durationMatch = String(data.duration).match(/(\d+(?:\.\d+)?)/);
    const hours = durationMatch ? Number(durationMatch[1]) : 1;
    const durationMinutes = data.durationMinutes || Math.max(30, Math.round(hours * 60));

    let matchedSpaceId = data.spaceId;
    if (!matchedSpaceId) {
      for (const [sid, info] of this.spaceLookup.entries()) {
        if (info.name === data.space || data.space.includes(info.name)) {
          matchedSpaceId = sid;
          break;
        }
      }
    }

    const payload: Record<string, any> = {
      name: data.name,
      space_id: matchedSpaceId,
      pricing_type: data.type,
      type: data.type,
      unit: data.unit,
      duration_minutes: durationMinutes,
      duration_label: data.duration,
      price: Number(data.price),
      description: data.inclusion,
      inclusion: data.inclusion,
      is_active: data.status === 'ACTIVE',
      status: data.status,
    };

    const req$ = id
      ? this.http.patch<any>(`/api/packages/${id}`, payload)
      : this.http.post<any>('/api/packages', payload);

    return req$.pipe(
      map((res) => {
        const doc = res?.item || res?.package || res;
        return doc?._id
          ? this.mapApiPackage(doc, new Map())
          : this.save(data, id);
      }),
      tap(() => {
        this.loadFromApi().subscribe();
      })
    );
  }

  toggleStatusApi(item: ServicePackage): Observable<any> {
    const nextActive = item.status !== 'ACTIVE';
    if (!this.http || !/^[a-f0-9]{24}$/i.test(item.id)) {
      this.toggleStatus(item.id);
      return of({ status: nextActive ? 'ACTIVE' : 'INACTIVE' });
    }
    const req$ = nextActive
      ? this.http.patch<any>(`/api/packages/${item.id}`, { is_active: true, status: 'ACTIVE' })
      : this.http.delete<any>(`/api/packages/${item.id}`);

    return req$.pipe(
      tap(() => {
        this.loadFromApi().subscribe();
      })
    );
  }

  save(data: Omit<ServicePackage, 'id'>, id?: string): ServicePackage {
    const packages = this.packagesSubject.value;
    const saved: ServicePackage = {
      ...data,
      id: id ?? this.nextId(data.group, data.space),
    };
    const next = id
      ? packages.map((item) => (item.id === id ? saved : item))
      : [...packages, saved];
    this.update(next);
    return saved;
  }

  duplicate(item: ServicePackage): ServicePackage {
    const newId = this.nextId(item.group, item.space);
    return this.save(
      {
        ...item,
        name: `${item.name} (Bản sao)`,
        status: 'ACTIVE',
      },
      newId
    );
  }

  toggleStatus(id: string): void {
    const next = this.packagesSubject.value.map((item) =>
      item.id === id
        ? { ...item, status: (item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE') as PackageStatus }
        : item
    );
    this.update(next);
  }

  delete(id: string): void {
    this.update(this.packagesSubject.value.filter((item) => item.id !== id));
  }

  resetToDefault(): void {
    this.update(INITIAL_PACKAGES);
  }

  private update(items: ServicePackage[]): void {
    this.packagesSubject.next(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore
    }
  }

  private loadPackages(): ServicePackage[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return INITIAL_PACKAGES;
      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_PACKAGES;
      return parsed as ServicePackage[];
    } catch {
      return INITIAL_PACKAGES;
    }
  }

  private nextId(group: ServicePackage['group'], space: string): string {
    let prefix = 'PK';
    if (space.includes('Work Lounge')) prefix = 'WL';
    else if (space.includes('Focus Pod')) prefix = 'FP';
    else if (space.includes('Small Meeting')) prefix = 'MR';
    else if (space.includes('Boardroom')) prefix = 'BR';
    else if (group === 'KÉN Tái Tạo') prefix = 'TT';

    const numbers = this.packagesSubject.value
      .filter((item) => item.id.startsWith(prefix))
      .map((item) => Number(item.id.replace(prefix + '-', '')))
      .filter(Number.isFinite);

    const nextNum = Math.max(0, ...numbers) + 1;
    return `${prefix}-${String(nextNum).padStart(2, '0')}`;
  }
}
