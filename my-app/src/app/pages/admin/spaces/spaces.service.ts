<<<<<<< HEAD
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
=======
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, forkJoin, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12

export type SpaceStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
export type BookingMode = 'SHARED' | 'PRIVATE';

<<<<<<< HEAD
export interface SpaceItem {
  id: string;
=======
export interface ZoneRef {
  id: string;
  code: string;
  name: string;
}

export interface SpaceItem {
  id: string;
  code?: string;
  zoneId?: string;
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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
<<<<<<< HEAD
=======
  bufferMinutes: number;
  futureBookingCount: number;
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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
<<<<<<< HEAD
    image: 'images/admin/package-work-lounge.png',
=======
    bufferMinutes: 0,
    futureBookingCount: 0,
    image: '/images/ken-flow/listing-work.png',
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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
<<<<<<< HEAD
    image: 'images/admin/package-focus-pod.jpeg',
=======
    bufferMinutes: 15,
    futureBookingCount: 0,
    image: '/images/ken-flow/listing-focus.png',
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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
<<<<<<< HEAD
    image: 'images/admin/package-meeting-room.png',
=======
    bufferMinutes: 15,
    futureBookingCount: 0,
    image: '/images/ken-flow/listing-meeting-small.png',
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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
<<<<<<< HEAD
    image: 'images/admin/package-meeting-room.png',
=======
    bufferMinutes: 15,
    futureBookingCount: 0,
    image: '/images/ken-flow/listing-meeting-small.png',
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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
<<<<<<< HEAD
    image: 'images/admin/package-bedroom.jpeg',
=======
    bufferMinutes: 15,
    futureBookingCount: 0,
    image: '/images/ken-flow/listing-single.png',
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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
<<<<<<< HEAD
    image: 'images/admin/package-bedroom.jpeg',
=======
    bufferMinutes: 15,
    futureBookingCount: 0,
    image: '/images/ken-flow/listing-single.png',
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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
<<<<<<< HEAD
    image: 'images/admin/package-focus-pod.jpeg',
=======
    bufferMinutes: 15,
    futureBookingCount: 0,
    image: '/images/ken-flow/listing-focus.png',
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  },
];

@Injectable({ providedIn: 'root' })
export class SpacesService {
<<<<<<< HEAD
  private readonly spacesSubject = new BehaviorSubject<SpaceItem[]>(this.loadSpaces());
  readonly spaces$ = this.spacesSubject.asObservable();
=======
  private readonly http = inject(HttpClient, { optional: true });
  private readonly spacesSubject = new BehaviorSubject<SpaceItem[]>(this.loadSpaces());
  private readonly zonesSubject = new BehaviorSubject<ZoneRef[]>([
    { id: 'z1', code: 'KEN_TAP_TRUNG', name: 'KÉN Tập Trung' },
    { id: 'z2', code: 'KEN_TAI_TAO', name: 'KÉN Tái Tạo' },
    { id: 'z3', code: 'KEN_KET_NOI', name: 'KÉN Kết Nối' },
  ]);

  readonly spaces$ = this.spacesSubject.asObservable();
  readonly zones$ = this.zonesSubject.asObservable();
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12

  get spaces(): SpaceItem[] {
    return this.spacesSubject.value;
  }

<<<<<<< HEAD
=======
  get zones(): ZoneRef[] {
    return this.zonesSubject.value;
  }

  loadFromApi(): Observable<SpaceItem[]> {
    if (!this.http) return of(this.spaces);
    return forkJoin({
      spaces: this.http.get<any>('/api/spaces?all=true').pipe(catchError(() => of(null))),
      zones: this.http.get<any>('/api/zones?all=true').pipe(catchError(() => of(null))),
    }).pipe(
      map((res) => {
        const rawZones = Array.isArray(res.zones)
          ? res.zones
          : res.zones?.items || res.zones?.data || [];
        const zoneMap = new Map<string, ZoneRef>();
        if (rawZones.length > 0) {
          const refs: ZoneRef[] = rawZones.map((z: any) => ({
            id: String(z._id || z.id),
            code: z.code || '',
            name: z.name || z.code || 'Khu vực',
          }));
          for (const r of refs) zoneMap.set(r.id, r);
          this.zonesSubject.next(refs);
        }

        const rawSpaces = Array.isArray(res.spaces)
          ? res.spaces
          : res.spaces?.items || res.spaces?.data || [];
        if (rawSpaces.length === 0 && res.spaces === null) {
          return this.spaces;
        }

        const mapped = rawSpaces.map((s: any) => this.mapApiSpace(s, zoneMap));
        this.update(mapped);
        return mapped;
      }),
    );
  }

  private mapApiSpace(s: any, zoneMap: Map<string, ZoneRef>): SpaceItem {
    const zId = s.zone_id ? String(s.zone_id) : s.zone?._id ? String(s.zone._id) : '';
    const zRef = zId ? zoneMap.get(zId) : undefined;
    const rawType = String(s.booking_mode || s.type || 'EXCLUSIVE').toUpperCase();
    const isShared = rawType === 'SHARED';
    const rawStatus = String(
      s.status || (s.is_active === false ? 'INACTIVE' : 'ACTIVE'),
    ).toUpperCase();
    const status: SpaceStatus =
      rawStatus === 'MAINTENANCE'
        ? 'MAINTENANCE'
        : rawStatus === 'INACTIVE' || s.is_active === false
          ? 'INACTIVE'
          : 'ACTIVE';
    const zoneName = zRef?.name || s.zone_name || s.zone?.name || 'KÉN Tập Trung';
    const fallbackImage = this.defaultImageForSpace(
      s.name || s.name_vi || zoneName,
      zoneName,
      isShared ? 'SHARED' : 'PRIVATE',
    );

    return {
      id: String(s._id || s.id),
      code: s.code || '',
      zoneId: zId,
      zone: zoneName,
      name: s.name || s.name_vi || 'Không gian KÉN',
      nameEn: s.name_en || s.english_name || s.code || '',
      type: isShared ? 'Dùng chung' : 'Dùng riêng',
      capacity: Number(s.capacity ?? 1),
      minGuest: Number(s.min_guests ?? s.min_guest ?? 1),
      maxGuest: Number(s.max_guests ?? s.max_guest ?? s.capacity ?? 1),
      priceLabel: isShared ? 'Theo người' : 'Theo không gian',
      status,
      amenities: Array.isArray(s.amenities) ? s.amenities : ['WiFi', 'Ổ cắm điện'],
      bookingMode: isShared ? 'SHARED' : 'PRIVATE',
      bufferMinutes: Number(s.buffer_minutes ?? (isShared ? 0 : 15)),
      futureBookingCount: Number(s.futureBookingCount ?? 0),
      image: this.normalizeImage(s.image_url || s.image || s.imageUrl, fallbackImage),
    };
  }

  private normalizeImage(value: unknown, fallback: string): string {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return fallback;
    if (raw.startsWith('http') || raw.startsWith('data:') || raw.startsWith('/')) return raw;
    return `/${raw.replace(/^\.?\//, '')}`;
  }

  private defaultImageForSpace(name: string, zone: string, bookingMode: BookingMode): string {
    const text = `${name} ${zone} ${bookingMode}`.toLowerCase();
    if (text.includes('focus') || text.includes('pod') || text.includes('tập trung cá nhân'))
      return '/images/ken-flow/listing-focus.png';
    if (text.includes('work') || text.includes('cowork') || text.includes('làm việc chung'))
      return '/images/ken-flow/listing-work.png';
    if (text.includes('họp') || text.includes('meeting') || text.includes('boardroom'))
      return '/images/ken-flow/listing-meeting-small.png';
    if (
      text.includes('nghỉ') ||
      text.includes('single') ||
      text.includes('double') ||
      text.includes('private')
    )
      return '/images/ken-flow/listing-single.png';
    return '/images/ken-flow/listing-focus.png';
  }

>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  findById(id: string): SpaceItem | undefined {
    return this.spaces.find((space) => space.id === id);
  }

<<<<<<< HEAD
=======
  saveSpace(
    space: Omit<SpaceItem, 'id' | 'bufferMinutes' | 'futureBookingCount'>,
    id?: string,
  ): Observable<SpaceItem> {
    const bufferMinutes = space.bookingMode === 'SHARED' ? 0 : 15;
    if (!this.http || (id && !/^[a-f0-9]{24}$/i.test(id))) {
      return of(this.save({ ...space, bufferMinutes, futureBookingCount: 0 }, id));
    }

    const matchedZone = this.zones.find((z) => z.name === space.zone || z.id === space.zoneId);
    const payload: Record<string, any> = {
      name: space.name,
      name_en: space.nameEn,
      zone_id: space.zoneId || matchedZone?.id,
      type: space.bookingMode === 'SHARED' ? 'SHARED' : 'EXCLUSIVE',
      booking_mode: space.bookingMode === 'SHARED' ? 'SHARED' : 'EXCLUSIVE',
      capacity: space.capacity,
      min_guests: space.minGuest,
      max_guests: space.maxGuest,
      buffer_minutes: bufferMinutes,
      status: space.status,
      is_active: space.status !== 'INACTIVE',
      amenities: space.amenities,
      image_url: space.image || undefined,
    };

    const req$ = id
      ? this.http.patch<any>(`/api/spaces/${id}`, payload)
      : this.http.post<any>('/api/spaces', payload);

    return req$.pipe(
      map((res) => {
        const doc = res?.item || res?.space || res;
        return doc?._id
          ? this.mapApiSpace(doc, new Map(this.zones.map((z) => [z.id, z])))
          : this.save({ ...space, bufferMinutes, futureBookingCount: 0 }, id);
      }),
      tap(() => {
        this.loadFromApi().subscribe();
      }),
    );
  }

  toggleStatusApi(space: SpaceItem): Observable<any> {
    const nextStatus: SpaceStatus = space.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (!this.http || !/^[a-f0-9]{24}$/i.test(space.id)) {
      this.toggleStatus(space.id);
      return of({ status: nextStatus });
    }
    const req$ =
      nextStatus === 'INACTIVE'
        ? this.http.delete<any>(`/api/spaces/${space.id}`)
        : this.http.patch<any>(`/api/spaces/${space.id}`, { status: 'ACTIVE', is_active: true });

    return req$.pipe(
      tap(() => {
        this.loadFromApi().subscribe();
      }),
    );
  }

>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  save(space: Omit<SpaceItem, 'id'>, id?: string): SpaceItem {
    const current = this.spaces;
    const savedSpace: SpaceItem = {
      ...space,
<<<<<<< HEAD
=======
      bufferMinutes: space.bookingMode === 'SHARED' ? 0 : 15,
      futureBookingCount: space.futureBookingCount ?? 0,
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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
<<<<<<< HEAD
      })
=======
      }),
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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
