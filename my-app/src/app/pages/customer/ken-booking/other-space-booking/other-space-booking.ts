import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { KenBookingState, kenMoney, kenNextDay } from '../booking-state';

interface SpaceRate {
  hours: number;
  price: number;
}

interface BookingSpace {
  name: string;
  image: string;
  capacity: string;
  minGuests: number;
  maxGuests: number;
  perPerson: boolean;
  rates: SpaceRate[];
}

const SPACES: Record<string, BookingSpace> = {
  work: {
    name: 'Khu làm việc chung',
    image: 'listing-work.png',
    capacity: '1–20 khách',
    minGuests: 1, maxGuests: 20, perPerson: true,
    rates: [
      { hours: 1, price: 30000 },
      { hours: 2, price: 60000 },
      { hours: 4, price: 90000 }
    ]
  },
  'meeting-small': {
    name: 'Phòng họp nhỏ',
    image: 'listing-meeting-small.png',
    capacity: '3–6 khách',
    minGuests: 3, maxGuests: 6, perPerson: false,
    rates: [{ hours: 3, price: 250000 }]
  },
  'meeting-large': {
    name: 'Phòng họp lớn',
    image: 'listing-meeting-large.png',
    capacity: '6–12 khách',
    minGuests: 6, maxGuests: 12, perPerson: false,
    rates: [{ hours: 3, price: 450000 }]
  },
  single: {
    name: 'KÉN nghỉ đơn',
    image: 'listing-single.png',
    capacity: '1 khách',
    minGuests: 1, maxGuests: 1, perPerson: false,
    rates: [
      { hours: 1, price: 70000 },
      { hours: 2, price: 130000 },
      { hours: 4, price: 220000 }
    ]
  },
  double: {
    name: 'KÉN nghỉ đôi',
    image: 'listing-double.png',
    capacity: '1–2 khách',
    minGuests: 1, maxGuests: 2, perPerson: false,
    rates: [
      { hours: 1, price: 100000 },
      { hours: 2, price: 180000 },
      { hours: 4, price: 310000 }
    ]
  },
  private: {
    name: 'Phòng riêng tư',
    image: 'listing-private.png',
    capacity: '2–4 khách',
    minGuests: 2, maxGuests: 4, perPerson: false,
    rates: [
      { hours: 1, price: 150000 },
      { hours: 2, price: 280000 },
      { hours: 4, price: 480000 }
    ]
  }
};

@Component({
  selector: 'app-ken-other-space-booking',
  standalone: false,
  templateUrl: './other-space-booking.html',
  styleUrl: './other-space-booking.css'
})
export class KenOtherSpacePage implements OnInit {
  space?: BookingSpace;
  date = kenNextDay();
  startHour = 9;
  guests = 1;
  duration = 1;
  message = '';

  readonly money = kenMoney;
  readonly allHours = Array.from({ length: 14 }, (_, i) => i + 8);

  constructor(
    private route: ActivatedRoute,
    public state: KenBookingState
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.space = SPACES[params.get('id') || ''];
      this.date = this.state.draft().date;
      this.startHour = this.state.draft().startHour;
      this.guests = this.space?.minGuests || 1;
      this.duration = this.space?.rates[0].hours || 1;
      this.startHour = Math.min(this.startHour, 22 - this.duration);
      this.message = '';
    });
  }

  get minDate(): string { return kenNextDay(); }

  get guestOptions(): number[] {
    if (!this.space) return [];
    return Array.from(
      { length: this.space.maxGuests - this.space.minGuests + 1 },
      (_, i) => this.space!.minGuests + i
    );
  }

  get allowedHours(): number[] {
    return this.allHours.filter(h => h + this.duration <= 22);
  }

  get total(): number {
    if (!this.space) return 0;
    const rate = this.space.rates.find(r => r.hours === this.duration);
    return (rate?.price || 0) * (this.space.perPerson ? this.guests : 1);
  }

  chooseDuration(hours: number): void {
    this.duration = hours;
    this.startHour = Math.min(this.startHour, 22 - hours);
    this.message = '';
  }

  confirm(): void {
    if (!this.space) return;

    const time = new Date(
      this.date + 'T' + String(this.startHour).padStart(2, '0') + ':00:00'
    ).getTime();

    if (
      !Number.isFinite(time) ||
      time - Date.now() < 30 * 60 * 1000 ||
      this.startHour + this.duration > 22 ||
      this.guests < this.space.minGuests ||
      this.guests > this.space.maxGuests
    ) {
      this.message = 'Vui lòng chọn ngày, giờ và số khách hợp lệ.';
      return;
    }

    this.message =
      'Đã ghi nhận lựa chọn ' + this.space.name +
      ' trên giao diện mô phỏng. Chưa tạo đơn đặt chỗ thực tế.';
  }
}
