import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, forkJoin, map, of, tap } from 'rxjs';
import { KenBookingState } from '../../customer/ken-booking/booking-state';

export type PackageStatus = 'ACTIVE' | 'INACTIVE';
export type PackageType = 'FIXED' | 'HOURLY';
export type PackageUnit = 'PER_PERSON' | 'PER_SPACE';

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
  spaceId?: string;
  inclusion: string;
  status: PackageStatus;
}

@Injectable({ providedIn: 'root' })
export class ServicePackagesService {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly bookingState = inject(KenBookingState, { optional: true });
  private readonly packagesSubject = new BehaviorSubject<ServicePackage[]>(this.loadPackages());
  readonly packages$ = this.packagesSubject.asObservable();

  private spaceLookup = new Map<string, { name: string; zoneName: string; type: string }>();
  private zoneLookup = new Map<string, string>();

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
        this.zoneLookup.clear();
        for (const z of rawZones) {
          this.zoneLookup.set(String(z._id || z.id), z.name || z.code || 'KÉN Tập Trung');
        }

        const rawSpaces = this.extractList(res.spaces);
        this.spaceLookup.clear();
        for (const s of rawSpaces) {
          const zName = this.zoneLookup.get(String(s.zone_id || '')) || s.zone_name || 'KÉN Tập Trung';
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
          const pVal = Number(pr.price);
          if (pid && pr.price != null && Number.isFinite(pVal)) {
            if (!priceByPkgSpace.has(pid) || pVal < priceByPkgSpace.get(pid)!) {
              priceByPkgSpace.set(pid, pVal);
            }
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
    const code = String(p.package_code || p.code || id.slice(-6)).toUpperCase();
    const spId = p.space_id ? String(p.space_id) : undefined;
    const spRef = spId ? this.spaceLookup.get(spId) : undefined;

    const zName = this.zoneLookup.get(String(p.zone_id || '')) || spRef?.zoneName || p.zone_name || '';
    const rawGroup = (code.startsWith('PKG_REST') || zName.includes('Tái Tạo'))
      ? 'KÉN Tái Tạo'
      : 'KÉN Tập Trung';

    const rawType = String(p.package_type || p.pricing_type || p.type || 'FIXED').toUpperCase();
    const pkgType: PackageType = (rawType === 'HOURLY' || code === 'PKG_FP_HOURLY' || code === 'PKG_WL_FLEX')
      ? 'HOURLY'
      : 'FIXED';

    const rawUnit = String(p.pricing_unit || p.unit || (code.startsWith('PKG_WL') ? 'PER_PERSON' : 'PER_SPACE')).toUpperCase();
    const pkgUnit: PackageUnit = rawUnit === 'PER_PERSON' ? 'PER_PERSON' : 'PER_SPACE';

    let mins = 60;
    let duration = '1 giờ';
    if (pkgType === 'HOURLY') {
      duration = 'Theo giờ';
      mins = 60;
    } else if (p.is_full_day) {
      duration = 'Cả ngày (14 giờ)';
      mins = 14 * 60;
    } else if (p.duration_hours) {
      duration = `${p.duration_hours} giờ`;
      mins = Number(p.duration_hours) * 60;
    } else if (p.duration_minutes) {
      mins = Number(p.duration_minutes);
      duration = mins >= 60 ? `${Math.round(mins / 60)} giờ` : `${mins} phút`;
    } else if (p.duration_label) {
      duration = p.duration_label;
    }

    let space = spRef?.name || p.space_name || '';
    if (!space) {
      if (code.startsWith('PKG_WL')) space = 'Work Lounge';
      else if (code.startsWith('PKG_FP')) space = 'Focus Pod';
      else if (code === 'PKG_SMR_3H') space = 'Small Meeting Room';
      else if (code === 'PKG_BR_3H') space = 'Boardroom';
      else if (code.startsWith('PKG_REST')) space = 'Kén nghỉ (Single / Double / Studio)';
      else space = 'Không gian KÉN';
    }

    let price = Number(p.price ?? p.base_price ?? priceByPkg.get(id) ?? 0);
    if (price === 0) {
      if (code === 'PKG_WL_FLEX') price = 30000;
      else if (code === 'PKG_WL_HALF') price = 90000;
      else if (code === 'PKG_WL_FULL') price = 150000;
      else if (code === 'PKG_FP_HOURLY') price = 45000;
      else if (code === 'PKG_FP_HALF') price = 140000;
      else if (code === 'PKG_SMR_3H') price = 250000;
      else if (code === 'PKG_BR_3H') price = 450000;
      else if (code === 'PKG_REST_1H') price = 70000;
      else if (code === 'PKG_REST_2H') price = 130000;
      else if (code === 'PKG_REST_4H') price = 220000;
      else if (code === 'PKG_REST_8H') price = 350000;
    }

    let inclusion = '';
    switch (code) {
      case 'PKG_FP_HOURLY':
        inclusion = '01 chai nước suối (nếu đặt từ 2 giờ trở lên)';
        break;
      case 'PKG_WL_FLEX':
        inclusion = 'Mỗi khách 01 chai nước suối (nếu đặt từ 2 giờ trở lên)';
        break;
      case 'PKG_FP_HALF':
        inclusion = '01 đồ uống Menu Tiêu chuẩn';
        break;
      case 'PKG_WL_HALF':
        inclusion = 'Mỗi khách 01 đồ uống Menu Tiêu chuẩn';
        break;
      case 'PKG_WL_FULL':
        inclusion = 'Mỗi khách 02 đồ uống Menu Tiêu chuẩn và 01 bánh';
        break;
      case 'PKG_SMR_3H':
        inclusion = 'Máy chiếu, bảng từ; mỗi khách 01 chai nước suối';
        break;
      case 'PKG_BR_3H':
        inclusion = 'Máy chiếu, bảng từ; mỗi khách 01 chai nước suối';
        break;
      case 'PKG_REST_1H':
        inclusion = 'Không bao gồm F&B';
        break;
      case 'PKG_REST_2H':
        inclusion = 'Mỗi khách 01 đồ uống Menu Tiêu chuẩn';
        break;
      case 'PKG_REST_4H':
        inclusion = 'Mỗi khách 01 đồ uống Menu Tiêu chuẩn và 01 bánh';
        break;
      case 'PKG_REST_8H':
        inclusion = 'Mỗi khách 02 đồ uống Menu Tiêu chuẩn và 01 bánh';
        break;
      default:
        inclusion = p.description || p.inclusion || '01 đồ uống chuẩn gói (hỗ trợ tối đa 50.000đ)';
    }

    const isActive = p.is_active !== false && String(p.status || 'ACTIVE').toUpperCase() === 'ACTIVE';

    return {
      id,
      code,
      name: p.name || 'Gói dịch vụ',
      shortName: space,
      group: rawGroup,
      type: pkgType,
      unit: pkgUnit,
      duration,
      durationMinutes: mins,
      price,
      space,
      spaceId: spId,
      inclusion,
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
        this.bookingState?.syncCatalogFromApi(true);
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
        this.bookingState?.syncCatalogFromApi(true);
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
    this.loadFromApi().subscribe();
  }

  private update(items: ServicePackage[]): void {
    this.packagesSubject.next(items);
  }

  private loadPackages(): ServicePackage[] {
    return [];
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
