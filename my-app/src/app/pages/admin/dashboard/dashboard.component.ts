import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

export interface HourlyRevenue {
  time: string;
  amount: number;
  label: string;
  heightPercent: number;
  isPeak?: boolean;
}

export interface ZoneActivity {
  id: string;
  name: string;
  subtitle: string;
  activeNow: string;
  todayCount: string;
  revenue: string;
  breakdown: string;
  note?: string;
  hasSpace?: boolean;
}

export interface PriorityTask {
  id: string;
  index: string;
  title: string;
  description: string;
  actionText: string;
  bookingCode?: string;
}

export interface UpcomingGuest {
  time: string;
  name: string;
  code: string;
  space: string;
  guests: string;
  paymentStatus: string;
  bookingStatus: string;
  actionLabel?: string;
  timeNote?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: false,
  styleUrl: './dashboard.component.css',
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly router = inject(Router);

  selectedPeriod: 'today' | '7days' | 'month' = 'today';
  fromDate = '2026-10-24';
  toDate = '2026-10-24';
  selectedZone = 'all';

  readonly hourlyData: HourlyRevenue[] = [
    { time: '08:00', amount: 420000, label: '420.000đ', heightPercent: 47 },
    { time: '08:30', amount: 360000, label: '360.000đ', heightPercent: 40 },
    { time: '09:00', amount: 620000, label: '620.000đ', heightPercent: 69 },
    { time: '09:30', amount: 400000, label: '400.000đ', heightPercent: 44 },
    { time: '10:00', amount: 637750, label: '637.750đ', heightPercent: 71, isPeak: true },
  ];

  readonly zones: ZoneActivity[] = [
    {
      id: 'tap-trung',
      name: 'KÉN Tập Trung',
      subtitle: '4 không gian · Làm việc & họp nhóm',
      activeNow: '3 đơn / 3 khách',
      todayCount: '17 đơn hôm nay',
      revenue: '1.717.750đ',
      breakdown: '5 xác nhận · 3 sử dụng · 7 hoàn thành · 1 huỷ · 1 No-show',
      hasSpace: true,
    },
    {
      id: 'tai-tao',
      name: 'KÉN Tái Tạo',
      subtitle: '3 không gian · Nghỉ ngơi & riêng tư',
      activeNow: '1 đơn / 1 khách',
      todayCount: '7 đơn hôm nay',
      revenue: '720.000đ',
      breakdown: '1 xác nhận · 1 sử dụng · 3 hoàn thành · 1 huỷ · 1 No-show',
      hasSpace: true,
    },
    {
      id: 'ket-noi',
      name: 'KÉN Kết Nối',
      subtitle: 'Café phục vụ trực tiếp · Walk-in',
      activeNow: 'Không có không gian đặt chỗ',
      todayCount: '0 đơn đặt chỗ',
      revenue: 'Không gộp vào báo cáo',
      breakdown: 'Doanh thu café walk-in chưa được đưa vào snapshot đặt chỗ này.',
      hasSpace: false,
    },
  ];

  readonly tasks: PriorityTask[] = [
    {
      id: 'task-1',
      index: '01',
      title: 'Khách chưa đến · KEN-241026-003',
      description: 'Bắt đầu 09:15 · Đã trễ 45 phút, vẫn thuộc 6 đơn xác nhận.',
      actionText: 'Kiểm tra No-show →',
      bookingCode: 'KEN-241026-003',
    },
    {
      id: 'task-2',
      index: '02',
      title: 'Trả chỗ · KEN-241026-008',
      description: 'Focus Pod kết thúc 10:00 · Dọn ô đến 10:15.',
      actionText: 'Mở đơn để Check-out →',
      bookingCode: 'KEN-241026-008',
    },
    {
      id: 'task-3',
      index: '03',
      title: 'Tiện ích Cáp + sạc tạm ngưng',
      description: '0 khả dụng · Kiểm tra thiết bị trước khi mở bán lại.',
      actionText: 'Mở Add-on & Sản phẩm →',
    },
  ];

  readonly upcomingGuests: UpcomingGuest[] = [
    {
      time: '10:00',
      name: 'Nguyễn Mai Anh',
      code: 'KEN-241026-002',
      space: 'Work Lounge',
      guests: '1 khách',
      paymentStatus: 'Đã thanh toán',
      bookingStatus: 'Đã xác nhận',
      actionLabel: 'CHECK-IN',
    },
    {
      time: '11:00',
      name: 'Lê Ngọc Linh',
      code: 'KEN-241026-004',
      space: 'Phòng họp nhỏ',
      guests: '4 khách',
      paymentStatus: 'Đã thanh toán',
      bookingStatus: 'Đã xác nhận',
      timeNote: 'Từ 10:45',
    },
    {
      time: '11:30',
      name: 'Nguyễn An Nhiên',
      code: 'KEN-241026-009',
      space: 'Work Lounge',
      guests: '1 khách',
      paymentStatus: 'Đã thanh toán',
      bookingStatus: 'Đã xác nhận',
      timeNote: 'Từ 11:15',
    },
  ];

  setPeriod(period: 'today' | '7days' | 'month'): void {
    this.selectedPeriod = period;
  }

  exportReport(): void {
    alert('Đang xuất báo cáo tổng quan vận hành ngày 24/10/2026 sang định dạng Excel/PDF...');
  }

  goToBookings(bookingCode?: string): void {
    if (bookingCode) {
      this.router.navigate(['/admin/bookings'], { queryParams: { code: bookingCode } });
    } else {
      this.router.navigate(['/admin/bookings']);
    }
  }

  handleCheckIn(guest: UpcomingGuest): void {
    alert(`Đã thực hiện check-in cho khách hàng: ${guest.name} (${guest.code})`);
    guest.actionLabel = undefined;
    guest.timeNote = 'Đã check-in lúc 10:00';
  }

  resetFilters(): void {
    this.selectedPeriod = 'today';
    this.fromDate = '2026-10-24';
    this.toDate = '2026-10-24';
    this.selectedZone = 'all';
  }
}

export { DashboardComponent as Dashboard };
