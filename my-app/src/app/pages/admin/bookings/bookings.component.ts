import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

export type BookingStatus = 'ALL' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface BookingRow {
  id: string;
  code: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  tier: string;
  points: string;
  discount: string;
  spaceName: string;
  packageType: string;
  zoneName: string;
  date: string;
  timeSlot: string;
  guestCount: number;
  finalAmount: string;
  paymentStatus: string;
  paymentTime: string;
  paymentMethod: string;
  txnCode: string;
  status: BookingStatus;
  statusLabel: string;
  statusBadgeClass: string;
  actionType?: 'CHECK_OUT' | 'CHECK_IN' | 'NO_SHOW' | 'NONE';
  actionLabel?: string;
  actionNote?: string;
}

@Component({
  selector: 'app-bookings',
  standalone: false,
  styleUrl: './bookings.component.css',
  templateUrl: './bookings.component.html',
})
export class BookingsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  statusCounts = {
    all: 24,
    confirmed: 6,
    checkedIn: 4,
    completed: 10,
    cancelled: 2,
    noShow: 2,
  };

  selectedFilter: BookingStatus = 'ALL';
  searchTerm = '';
  selectedDate = '24/10/2026';
  selectedTime = 'Cả ngày';
  selectedZone = 'Tất cả';
  selectedPayment = 'Tất cả';

  readonly bookings: BookingRow[] = [
    {
      id: 'b1',
      code: 'KEN-241026-001',
      customerName: 'Thầy Thanh đẹp trai',
      customerEmail: 'thanh@example.com',
      customerPhone: '•••• •• 0123',
      tier: 'Bạc · 3.250 điểm',
      points: '3.250',
      discount: 'Giảm 5%',
      spaceName: 'Focus Pod',
      packageType: 'Nửa ngày · 4 giờ',
      zoneName: 'Tầng 1 · Khu Yên Tĩnh',
      date: '24/10/2026',
      timeSlot: '09:00–13:00',
      guestCount: 1,
      finalAmount: '137.750đ',
      paymentStatus: 'Đã thanh toán',
      paymentTime: '08:42 · 24/10/2026',
      paymentMethod: 'Chuyển khoản',
      txnCode: 'TXN-001-2026',
      status: 'CHECKED_IN',
      statusLabel: 'Đang sử dụng',
      statusBadgeClass: 'badge-checked-in',
      actionType: 'CHECK_OUT',
      actionLabel: 'CHECK-OUT',
      actionNote: 'Check-in lúc 08:55',
    },
    {
      id: 'b2',
      code: 'KEN-241026-002',
      customerName: 'Nguyễn Mai Anh',
      customerEmail: 'mai@example.com',
      customerPhone: '•••• •• 4567',
      tier: 'Đồng · 800 điểm',
      points: '800',
      discount: 'Không giảm',
      spaceName: 'Work Lounge',
      packageType: 'Linh hoạt · 1 giờ',
      zoneName: 'Tầng 1 · Khu Tập Trung',
      date: '24/10/2026',
      timeSlot: '10:00–11:00',
      guestCount: 1,
      finalAmount: '30.000đ',
      paymentStatus: 'Đã thanh toán',
      paymentTime: '09:20 · 24/10/2026',
      paymentMethod: 'Ví MoMo',
      txnCode: 'TXN-002-2026',
      status: 'CONFIRMED',
      statusLabel: 'Đã xác nhận',
      statusBadgeClass: 'badge-confirmed',
      actionType: 'CHECK_IN',
      actionLabel: 'CHECK-IN',
      actionNote: 'Mở từ 09:45',
    },
    {
      id: 'b3',
      code: 'KEN-241026-003',
      customerName: 'Trần Minh Khôi',
      customerEmail: 'khoi@example.com',
      customerPhone: '•••• •• 8910',
      tier: 'Bạc · 2.100 điểm',
      points: '2.100',
      discount: 'Giảm 5%',
      spaceName: 'Focus Pod',
      packageType: 'Theo giờ · 1 giờ',
      zoneName: 'Tầng 1 · Khu Yên Tĩnh',
      date: '24/10/2026',
      timeSlot: '09:15–10:15',
      guestCount: 1,
      finalAmount: '45.000đ',
      paymentStatus: 'Đã thanh toán',
      paymentTime: '08:50 · 24/10/2026',
      paymentMethod: 'Chuyển khoản',
      txnCode: 'TXN-003-2026',
      status: 'CONFIRMED',
      statusLabel: 'Đã xác nhận',
      statusBadgeClass: 'badge-confirmed',
      actionType: 'NO_SHOW',
      actionLabel: 'NO-SHOW',
      actionNote: 'Chưa đến · Trễ 45′',
    },
    {
      id: 'b4',
      code: 'KEN-241026-004',
      customerName: 'Lê Ngọc Linh',
      customerEmail: 'linh@example.com',
      customerPhone: '•••• •• 2468',
      tier: 'Vàng · 5.400 điểm',
      points: '5.400',
      discount: 'Giảm 10%',
      spaceName: 'Small Meeting Room',
      packageType: 'Họp nhóm · 3 giờ',
      zoneName: 'Tầng 2 · Phòng Họp',
      date: '24/10/2026',
      timeSlot: '11:00–14:00',
      guestCount: 4,
      finalAmount: '250.000đ',
      paymentStatus: 'Đã thanh toán',
      paymentTime: '09:00 · 24/10/2026',
      paymentMethod: 'Thẻ ATM / QR',
      txnCode: 'TXN-004-2026',
      status: 'CONFIRMED',
      statusLabel: 'Đã xác nhận',
      statusBadgeClass: 'badge-confirmed',
      actionType: 'NONE',
      actionNote: 'Mở nhận chỗ lúc 10:45',
    },
    {
      id: 'b5',
      code: 'KEN-241026-008',
      customerName: 'Bùi Anh Tú',
      customerEmail: 'tu@example.com',
      customerPhone: '•••• •• 1357',
      tier: 'Bạc · 2.900 điểm',
      points: '2.900',
      discount: 'Giảm 5%',
      spaceName: 'Focus Pod',
      packageType: 'Theo giờ · 2 giờ',
      zoneName: 'Tầng 1 · Khu Yên Tĩnh',
      date: '24/10/2026',
      timeSlot: '08:00–10:00',
      guestCount: 1,
      finalAmount: '90.000đ',
      paymentStatus: 'Đã thanh toán',
      paymentTime: '07:50 · 24/10/2026',
      paymentMethod: 'Chuyển khoản',
      txnCode: 'TXN-008-2026',
      status: 'CHECKED_IN',
      statusLabel: 'Đang sử dụng',
      statusBadgeClass: 'badge-checked-in',
      actionType: 'CHECK_OUT',
      actionLabel: 'CHECK-OUT',
      actionNote: 'Đến giờ trả chỗ',
    },
  ];

  selectedBooking: BookingRow = this.bookings[0];

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['code']) {
        const found = this.bookings.find((b) => b.code === params['code']);
        if (found) {
          this.selectedBooking = found;
        }
      }
    });
  }

  get filteredBookings(): BookingRow[] {
    return this.bookings.filter((b) => {
      const matchFilter =
        this.selectedFilter === 'ALL' || b.status === this.selectedFilter;
      const matchSearch =
        !this.searchTerm ||
        b.code.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        b.customerName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        b.customerEmail.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchFilter && matchSearch;
    });
  }

  selectBooking(b: BookingRow): void {
    this.selectedBooking = b;
  }

  filterByStatus(status: BookingStatus): void {
    this.selectedFilter = status;
  }

  handleCheckOut(booking: BookingRow): void {
    alert(`Xác nhận Check-out thành công cho đơn ${booking.code} (${booking.customerName})!\nCộng +13 Điểm và +13 Coins cho khách hàng.`);
    booking.status = 'COMPLETED';
    booking.statusLabel = 'Hoàn thành';
    booking.statusBadgeClass = 'badge-completed';
    booking.actionType = 'NONE';
    booking.actionNote = 'Đã hoàn tất lúc 10:00';
  }

  handleCheckIn(booking: BookingRow): void {
    alert(`Xác nhận Check-in thành công cho đơn ${booking.code} (${booking.customerName})!`);
    booking.status = 'CHECKED_IN';
    booking.statusLabel = 'Đang sử dụng';
    booking.statusBadgeClass = 'badge-checked-in';
    booking.actionType = 'CHECK_OUT';
    booking.actionLabel = 'CHECK-OUT';
    booking.actionNote = 'Check-in lúc 10:00';
  }

  handleNoShow(booking: BookingRow): void {
    if (confirm(`Xác nhận khách không đến (No-show) cho đơn ${booking.code}?`)) {
      booking.status = 'NO_SHOW';
      booking.statusLabel = 'Khách không đến';
      booking.statusBadgeClass = 'badge-no-show';
      booking.actionType = 'NONE';
      booking.actionNote = 'Đã xác nhận No-show';
    }
  }

  resetFilters(): void {
    this.selectedFilter = 'ALL';
    this.searchTerm = '';
    this.selectedDate = '24/10/2026';
    this.selectedTime = 'Cả ngày';
    this.selectedZone = 'Tất cả';
    this.selectedPayment = 'Tất cả';
  }
}

export { BookingsComponent as Bookings };
