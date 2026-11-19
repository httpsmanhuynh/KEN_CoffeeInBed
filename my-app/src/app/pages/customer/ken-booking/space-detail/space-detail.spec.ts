import { KenBookingSpaceDetailPage } from './space-detail';
import { KenBookingState } from '../booking-state';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

describe('KenBookingSpaceDetailPage', () => {
  it('loads the selected space and points to its schedule picker', () => {
    const route = {
      paramMap: of(convertToParamMap({ id: 'meeting-large' })),
    } as ActivatedRoute;
    const page = new KenBookingSpaceDetailPage(route, { navigateByUrl: vi.fn() } as unknown as Router, new KenBookingState());
    page.ngOnInit();

    expect(page.space?.name).toBe('Phòng họp lớn');
    expect(page.bookingPath()).toBe('/booking/meeting-large');
    expect(page.getRateLabel({ hours: 3, price: 450000 })).toBe('3 giờ');
  });
});
