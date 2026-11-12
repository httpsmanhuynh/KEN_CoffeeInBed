import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';

export interface KenAvailabilityPackage {
  durationHours: number | null;
  pricing_type?: string;
  pricingType?: string;
  isAvailable: boolean;
}

export interface KenAvailabilitySpace {
  space_code?: string;
  name: string;
  isAvailable: boolean;
  availabilityReason?: string | null;
  remainingCapacity?: number;
  packages?: KenAvailabilityPackage[];
}

@Injectable({ providedIn: 'root' })
export class KenAvailabilityService {
  constructor(private http: HttpClient) {}

  check(date: string, startHour: number, guests: number, hours: number): Observable<KenAvailabilitySpace[]> {
    const startAt = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00+07:00`);
    if (!Number.isFinite(startAt.getTime())) {
      return throwError(() => new Error('Vui lòng chọn ngày và giờ hợp lệ.'));
    }
    const params = new HttpParams()
      .set('startAt', startAt.toISOString())
      .set('hours', String(hours))
      .set('guestCount', String(guests));
    return this.http.get<KenAvailabilitySpace[]>('/api/spaces', { params });
  }

  forSpace(spaceId: string, spaces: KenAvailabilitySpace[]): KenAvailabilitySpace | undefined {
    return spaces.find(space => this.spaceIdFor(space) === spaceId);
  }

  packageAvailable(space: KenAvailabilitySpace | undefined, hours: number): boolean {
    if (!space?.packages?.length) return false;
    const exact = space.packages.find(pkg => pkg.durationHours === hours && pkg.isAvailable);
    if (exact) return true;
    const isHourly = (pkg: KenAvailabilityPackage) =>
      pkg.pricing_type === 'HOURLY' || pkg.pricingType === 'HOURLY' || pkg.durationHours === null || pkg.durationHours === 1;
    return space.packages.some(pkg => isHourly(pkg) && pkg.isAvailable);
  }

  private spaceIdFor(space: KenAvailabilitySpace): string | undefined {
    const identity = `${space.space_code || ''} ${space.name}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('en');
    if (identity.includes('single') || identity.includes('nghi don')) return 'single';
    if (identity.includes('double') || identity.includes('nghi doi')) return 'double';
    if (identity.includes('private') || identity.includes('phong rieng')) return 'private';
    if (identity.includes('lmr') || identity.includes('hop lon') ||
        (identity.includes('meeting') && identity.includes('large'))) return 'meeting-large';
    if (identity.includes('smr') || identity.includes('hop nho') ||
        (identity.includes('meeting') && identity.includes('small'))) return 'meeting-small';
    if (identity.includes('focus') || identity.includes('pod') ||
        identity.includes('tap trung')) return 'focus';
    if (identity.includes('work') || identity.includes('lounge') ||
        identity.includes('wl-') || identity.includes('lam viec chung')) return 'work';
    return undefined;
  }
}
