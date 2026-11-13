import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type PackageType = 'FIXED' | 'HOURLY';
export type PackageUnit = 'PER_SPACE' | 'PER_PERSON';
export type PackageStatus = 'ACTIVE' | 'INACTIVE';

export interface ServicePackage {
  id: string;
  name: string;
  shortName: string;
  group: 'KÉN Tập Trung' | 'KÉN Tái Tạo';
  type: PackageType;
  unit: PackageUnit;
  duration: string;
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
    price: 350000,
    space: 'Single / Double / Studio',
    spaceId: 's5',
    inclusion: 'Single 350.000đ · Double 490.000đ · Studio 770.000đ',
    status: 'ACTIVE',
  },
];

@Injectable({ providedIn: 'root' })
export class ServicePackagesService {
  private readonly packagesSubject = new BehaviorSubject<ServicePackage[]>(this.loadPackages());
  readonly packages$ = this.packagesSubject.asObservable();

  get packages(): ServicePackage[] {
    return this.packagesSubject.value;
  }

  findById(id: string): ServicePackage | undefined {
    return this.packagesSubject.value.find((item) => item.id === id);
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
    return this.save({
      ...item,
      name: `${item.name} (Bản sao)`,
      status: 'ACTIVE',
    }, newId);
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
      // Ignore if localStorage unavailable
    }
  }

  private loadPackages(): ServicePackage[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return INITIAL_PACKAGES;
      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_PACKAGES;

      const corrected = (parsed as ServicePackage[]).map((item) => {
        if (item.id === 'TT-01' && item.name === 'Ngủ nhanh') {
          return { ...item, name: 'Nghỉ nhanh' };
        }
        if (item.id === 'TT-02' && item.name === 'Ngủ lưng') {
          return { ...item, name: 'Ngả lưng' };
        }
        return item;
      });

      if (JSON.stringify(corrected) !== JSON.stringify(parsed)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(corrected));
      }
      return corrected;
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
