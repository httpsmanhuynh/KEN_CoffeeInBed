import { Component, OnInit } from '@angular/core';

export type CustomerTier = 'ALL' | 'NONE' | 'DONG' | 'BAC' | 'VANG' | 'KIM_CUONG';
export type CustomerStatus = 'ALL' | 'ACTIVE' | 'LOCKED';

export interface CustomerBookingHistory {
  code: string;
  spaceName: string;
  date: string;
  status: string;
  statusClass: string;
  totalAmount: string;
}

export interface CustomerItem {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  tier: string;
  tierKey: CustomerTier;
  tierBadgeClass: string;
  points: number;
  pointsFormatted: string;
  coins: number;
  coinsFormatted: string;
  status: 'ACTIVE' | 'LOCKED';
  statusLabel: string;
  statusBadgeClass: string;
  joinDate: string;
  totalOrders: number;
  totalSpendFormatted: string;
  progressText: string;
  progressPercent: number;
  tierRange: string;
  tierDiscount: string;
  bookingHistory: CustomerBookingHistory[];
}

@Component({
  selector: 'app-customers',
  standalone: false,
  styleUrl: './customers.component.css',
  templateUrl: './customers.component.html',
})
export class CustomersComponent implements OnInit {
  searchTerm = '';
  selectedTierFilter: CustomerTier = 'ALL';
  selectedStatusFilter: CustomerStatus = 'ALL';
  activeTab: 'ALL' | 'ACTIVE' | 'LOCKED' = 'ALL';

  readonly customers: CustomerItem[] = [
    {
      id: 'c1',
      code: 'KH-001',
      name: 'Thầy Thanh đẹp trai',
      phone: '•••• •• 0123',
      email: 'thanh@example.com',
      tier: 'Bạc',
      tierKey: 'BAC',
      tierBadgeClass: 'badge-tier-silver',
      points: 3250,
      pointsFormatted: '3.250',
      coins: 650,
      coinsFormatted: '650',
      status: 'ACTIVE',
      statusLabel: 'Hoạt động',
      statusBadgeClass: 'badge-status-active',
      joinDate: '15/03/2026',
      totalOrders: 48,
      totalSpendFormatted: '32.500.000đ',
      progressText: '3.250 / 5.000 điểm đến Vàng · 65%',
      progressPercent: 65,
      tierRange: 'Bạc (1.000 – 4.999 điểm)',
      tierDiscount: 'Giảm 5% tổng hoá đơn',
      bookingHistory: [
        { code: 'KEN-221026-018', spaceName: 'Focus Pod', date: '22/10/2026', status: 'Hoàn thành', statusClass: 'badge-booking-done', totalAmount: '137.750đ' },
        { code: 'KEN-201026-005', spaceName: 'Work Lounge', date: '20/10/2026', status: 'Hoàn thành', statusClass: 'badge-booking-done', totalAmount: '60.000đ' },
        { code: 'KEN-181026-012', spaceName: 'Small Meeting Room', date: '18/10/2026', status: 'Hoàn thành', statusClass: 'badge-booking-done', totalAmount: '350.000đ' },
      ],
    },
    {
      id: 'c2',
      code: 'KH-002',
      name: 'Nguyễn Mai Anh',
      phone: '•••• •• 0456',
      email: 'mai@example.com',
      tier: 'Chưa đạt hạng',
      tierKey: 'NONE',
      tierBadgeClass: 'badge-tier-none',
      points: 450,
      pointsFormatted: '450',
      coins: 120,
      coinsFormatted: '120',
      status: 'ACTIVE',
      statusLabel: 'Hoạt động',
      statusBadgeClass: 'badge-status-active',
      joinDate: '02/09/2026',
      totalOrders: 5,
      totalSpendFormatted: '4.500.000đ',
      progressText: '450 / 1.000 điểm đến Đồng · 45%',
      progressPercent: 45,
      tierRange: 'Chưa đạt hạng (0 – 999 điểm)',
      tierDiscount: 'Tích luỹ điểm xét hạng',
      bookingHistory: [
        { code: 'KEN-241026-002', spaceName: 'Work Lounge', date: '24/10/2026', status: 'Đã xác nhận', statusClass: 'badge-booking-confirmed', totalAmount: '30.000đ' },
        { code: 'KEN-151026-008', spaceName: 'Focus Pod', date: '15/10/2026', status: 'Hoàn thành', statusClass: 'badge-booking-done', totalAmount: '45.000đ' },
      ],
    },
    {
      id: 'c3',
      code: 'KH-003',
      name: 'Trần Minh Khôi',
      phone: '•••• •• 0789',
      email: 'khoi@example.com',
      tier: 'Vàng',
      tierKey: 'VANG',
      tierBadgeClass: 'badge-tier-gold',
      points: 5200,
      pointsFormatted: '5.200',
      coins: 900,
      coinsFormatted: '900',
      status: 'ACTIVE',
      statusLabel: 'Hoạt động',
      statusBadgeClass: 'badge-status-active',
      joinDate: '10/01/2026',
      totalOrders: 62,
      totalSpendFormatted: '52.000.000đ',
      progressText: '5.200 / 10.000 điểm đến Kim cương · 52%',
      progressPercent: 52,
      tierRange: 'Vàng (5.000 – 9.999 điểm)',
      tierDiscount: 'Giảm 10% tổng hoá đơn',
      bookingHistory: [
        { code: 'KEN-241026-003', spaceName: 'Focus Pod', date: '24/10/2026', status: 'Đã xác nhận', statusClass: 'badge-booking-confirmed', totalAmount: '45.000đ' },
      ],
    },
    {
      id: 'c4',
      code: 'KH-004',
      name: 'Lê Ngọc Linh',
      phone: '•••• •• 0321',
      email: 'linh@example.com',
      tier: 'Kim cương',
      tierKey: 'KIM_CUONG',
      tierBadgeClass: 'badge-tier-diamond',
      points: 10800,
      pointsFormatted: '10.800',
      coins: 1800,
      coinsFormatted: '1.800',
      status: 'ACTIVE',
      statusLabel: 'Hoạt động',
      statusBadgeClass: 'badge-status-active',
      joinDate: '01/11/2025',
      totalOrders: 110,
      totalSpendFormatted: '108.000.000đ',
      progressText: 'Hạng cao nhất · Kim cương VIP',
      progressPercent: 100,
      tierRange: 'Kim cương (Từ 10.000 điểm)',
      tierDiscount: 'Giảm 15% tổng hoá đơn + Quà sinh nhật VIP',
      bookingHistory: [
        { code: 'KEN-241026-004', spaceName: 'Small Meeting Room', date: '24/10/2026', status: 'Đã xác nhận', statusClass: 'badge-booking-confirmed', totalAmount: '250.000đ' },
      ],
    },
    {
      id: 'c5',
      code: 'KH-005',
      name: 'Phạm Gia Hân',
      phone: '•••• •• 0654',
      email: 'han@example.com',
      tier: 'Bạc',
      tierKey: 'BAC',
      tierBadgeClass: 'badge-tier-silver',
      points: 2800,
      pointsFormatted: '2.800',
      coins: 400,
      coinsFormatted: '400',
      status: 'ACTIVE',
      statusLabel: 'Hoạt động',
      statusBadgeClass: 'badge-status-active',
      joinDate: '20/04/2026',
      totalOrders: 28,
      totalSpendFormatted: '28.000.000đ',
      progressText: '2.800 / 5.000 điểm đến Vàng · 56%',
      progressPercent: 56,
      tierRange: 'Bạc (1.000 – 4.999 điểm)',
      tierDiscount: 'Giảm 5% tổng hoá đơn',
      bookingHistory: [],
    },
    {
      id: 'c6',
      code: 'KH-006',
      name: 'Đỗ Hoàng Nam',
      phone: '•••• •• 0987',
      email: 'nam@example.com',
      tier: 'Đồng',
      tierKey: 'DONG',
      tierBadgeClass: 'badge-tier-bronze',
      points: 1200,
      pointsFormatted: '1.200',
      coins: 210,
      coinsFormatted: '210',
      status: 'LOCKED',
      statusLabel: 'Tạm khoá',
      statusBadgeClass: 'badge-status-locked',
      joinDate: '12/06/2026',
      totalOrders: 14,
      totalSpendFormatted: '12.000.000đ',
      progressText: '1.200 / 3.000 điểm đến Bạc',
      progressPercent: 40,
      tierRange: 'Đồng (1.000 – 2.999 điểm)',
      tierDiscount: 'Ưu đãi tích luỹ Coins',
      bookingHistory: [],
    },
  ];

  selectedCustomer: CustomerItem = this.customers[0];

  ngOnInit(): void {}

  get counts() {
    const active = this.customers.filter((c) => c.status === 'ACTIVE').length;
    const locked = this.customers.filter((c) => c.status === 'LOCKED').length;
    return { all: this.customers.length, active, locked };
  }

  get filteredCustomers(): CustomerItem[] {
    return this.customers.filter((c) => {
      const matchTab =
        this.activeTab === 'ALL' || c.status === this.activeTab;
      const matchTier =
        this.selectedTierFilter === 'ALL' || c.tierKey === this.selectedTierFilter;
      const matchStatus =
        this.selectedStatusFilter === 'ALL' || c.status === this.selectedStatusFilter;
      const matchSearch =
        !this.searchTerm ||
        c.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchTab && matchTier && matchStatus && matchSearch;
    });
  }

  selectCustomer(c: CustomerItem): void {
    this.selectedCustomer = c;
  }

  setTab(tab: 'ALL' | 'ACTIVE' | 'LOCKED'): void {
    this.activeTab = tab;
  }

  toggleLockCustomer(c: CustomerItem): void {
    if (c.status === 'ACTIVE') {
      if (confirm(`Bạn có chắc chắn muốn TẠM KHOÁ tài khoản ${c.name} (${c.code})? Khách sẽ không thể đăng nhập và đặt mới.`)) {
        c.status = 'LOCKED';
        c.statusLabel = 'Tạm khoá';
        c.statusBadgeClass = 'badge-status-locked';
      }
    } else {
      if (confirm(`MỞ KHOÁ tài khoản ${c.name} (${c.code}) để khách có thể tiếp tục sử dụng?`)) {
        c.status = 'ACTIVE';
        c.statusLabel = 'Hoạt động';
        c.statusBadgeClass = 'badge-status-active';
      }
    }
  }

  exportList(): void {
    alert('Đang xuất danh sách khách hàng & thành viên sang file Excel/CSV...');
  }
}

export { CustomersComponent as Customers };
