import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type SpaceStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
export type BookingMode = 'SHARED' | 'PRIVATE';

export interface SpaceItem {
  id: string;
  zone: string;
  name: string;
  nameEn: string;
  type: string;
  capacity: number;
  minGuest: number;
  maxGuest: number;
  priceLabel: string;
  status: SpaceStatus;
  amenities: string[];
  bookingMode: BookingMode;
  image?: string;
}

const STORAGE_KEY = 'ken-admin-spaces-v2';

const INITIAL_SPACES: SpaceItem[] = [
  {
    id: 's1',
    zone: 'KÉN Tập Trung',
    name: 'Khu làm việc chung',
    nameEn: 'Work Lounge',
    type: 'Dùng chung',
    capacity: 20,
    minGuest: 1,
    maxGuest: 20,
    priceLabel: 'Theo người',
    status: 'ACTIVE',
    amenities: ['WiFi', 'Ổ cắm điện', 'Đặt chỗ trực tuyến'],
    bookingMode: 'SHARED',
    image: 'images/admin/package-work-lounge.png',
  },
  {
    id: 's2',
    zone: 'KÉN Tập Trung',
    name: 'Ô tập trung cá nhân',
    nameEn: 'Focus Pod',
    type: 'Dùng riêng',
    capacity: 1,
    minGuest: 1,
    maxGuest: 1,
    priceLabel: 'Theo không gian',
    status: 'ACTIVE',
    amenities: ['WiFi', 'Ổ cắm điện', 'Đặt chỗ trực tuyến'],
    bookingMode: 'PRIVATE',
    image: 'images/admin/package-focus-pod.jpeg',
  },
  {
    id: 's3',
    zone: 'KÉN Tập Trung',
    name: 'Phòng họp nhỏ',
    nameEn: 'Small Meeting Room',
    type: 'Dùng riêng',
    capacity: 6,
    minGuest: 3,
    maxGuest: 6,
    priceLabel: 'Theo không gian',
    status: 'ACTIVE',
    amenities: ['WiFi', 'Ổ cắm điện', 'Đặt chỗ trực tuyến'],
    bookingMode: 'PRIVATE',
    image: 'images/admin/package-meeting-room.png',
  },
  {
    id: 's4',
    zone: 'KÉN Tập Trung',
    name: 'Phòng họp lớn',
    nameEn: 'Boardroom',
    type: 'Dùng riêng',
    capacity: 12,
    minGuest: 6,
    maxGuest: 12,
    priceLabel: 'Theo không gian',
    status: 'ACTIVE',
    amenities: ['WiFi', 'Ổ cắm điện', 'Đặt chỗ trực tuyến', 'Đặt theo giờ'],
    bookingMode: 'PRIVATE',
    image: 'images/admin/package-meeting-room.png',
  },
  {
    id: 's5',
    zone: 'KÉN Tái Tạo',
    name: 'KÉN nghỉ đơn',
    nameEn: 'Single Bed Pod',
    type: 'Dùng riêng',
    capacity: 1,
    minGuest: 1,
    maxGuest: 1,
    priceLabel: 'Theo không gian',
    status: 'ACTIVE',
    amenities: ['WiFi', 'Đặt chỗ trực tuyến', 'Đặt theo giờ'],
    bookingMode: 'PRIVATE',
    image: 'images/admin/package-bedroom.jpeg',
  },
  {
    id: 's6',
    zone: 'KÉN Tái Tạo',
    name: 'KÉN nghỉ đôi',
    nameEn: 'Double Bed Pod',
    type: 'Dùng riêng',
    capacity: 2,
    minGuest: 1,
    maxGuest: 2,
    priceLabel: 'Theo không gian',
    status: 'ACTIVE',
    amenities: ['WiFi', 'Đặt chỗ trực tuyến', 'Đặt theo giờ'],
    bookingMode: 'PRIVATE',
    image: 'images/admin/package-bedroom.jpeg',
  },
  {
    id: 's7',
    zone: 'KÉN Tái Tạo',
    name: 'Phòng riêng tư',
    nameEn: 'Private Studio',
    type: 'Dùng riêng',
    capacity: 4,
    minGuest: 2,
    maxGuest: 4,
    priceLabel: 'Theo không gian',
    status: 'INACTIVE',
    amenities: ['WiFi', 'Ổ cắm điện', 'Đặt chỗ trực tuyến', 'Đặt theo giờ'],
    bookingMode: 'PRIVATE',
    image: 'images/admin/package-focus-pod.jpeg',
  },
];

@Injectable({ providedIn: 'root' })
export class SpacesService {
  private readonly spacesSubject = new BehaviorSubject<SpaceItem[]>(this.loadSpaces());
  readonly spaces$ = this.spacesSubject.asObservable();

  get spaces(): SpaceItem[] {
    return this.spacesSubject.value;
  }

  findById(id: string): SpaceItem | undefined {
    return this.spaces.find((space) => space.id === id);
  }

  save(space: Omit<SpaceItem, 'id'>, id?: string): SpaceItem {
    const current = this.spaces;
    const savedSpace: SpaceItem = {
      ...space,
      id: id ?? `s${Date.now()}`,
    };
    const next = id
      ? current.map((item) => (item.id === id ? savedSpace : item))
      : [...current, savedSpace];
    this.update(next);
    return savedSpace;
  }

  toggleStatus(id: string): void {
    this.update(
      this.spaces.map((space) => {
        if (space.id === id) {
          const nextStatus: SpaceStatus = space.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
          return { ...space, status: nextStatus };
        }
        return space;
      })
    );
  }

  delete(id: string): void {
    this.update(this.spaces.filter((space) => space.id !== id));
  }

  resetToDefault(): void {
    this.update(INITIAL_SPACES);
  }

  private update(spaces: SpaceItem[]): void {
    this.spacesSubject.next(spaces);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(spaces));
    } catch {
      // Ignore if localStorage unavailable
    }
  }

  private loadSpaces(): SpaceItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return INITIAL_SPACES;
      }
      const parsed = JSON.parse(stored) as unknown;
      return Array.isArray(parsed) && parsed.length > 0 ? (parsed as SpaceItem[]) : INITIAL_SPACES;
    } catch {
      return INITIAL_SPACES;
    }
  }
}
