<<<<<<< HEAD
import { Component, OnInit } from '@angular/core';

export type CustomerTier = 'ALL' | 'NONE' | 'DONG' | 'BAC' | 'VANG' | 'KIM_CUONG';
export type CustomerStatus = 'ALL' | 'ACTIVE' | 'LOCKED';

export interface CustomerBookingHistory {
=======
import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export type CustomerTier = 'ALL' | 'CHUA_DAT_HANG' | 'BAC' | 'VANG' | 'KIM_CUONG';
export type CustomerStatus = 'ALL' | 'ACTIVE' | 'LOCKED';

export interface CustomerBookingHistory {
  id: string;
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  code: string;
  spaceName: string;
  date: string;
  status: string;
  statusClass: string;
<<<<<<< HEAD
  totalAmount: string;
=======
  totalAmount: number;
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
}

export interface CustomerItem {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string;
<<<<<<< HEAD
  tier: string;
  tierKey: CustomerTier;
=======
  role: string;
  tier: string;
  tierKey: Exclude<CustomerTier, 'ALL'>;
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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
<<<<<<< HEAD
=======
  totalSpend: number;
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  totalSpendFormatted: string;
  progressText: string;
  progressPercent: number;
  tierRange: string;
  tierDiscount: string;
  bookingHistory: CustomerBookingHistory[];
<<<<<<< HEAD
}

=======
  historyLoaded?: boolean;
}

const BOOKING_STATUS_CLASS: Record<string, { label: string; cls: string }> = {
  CHECKED_OUT: { label: 'Hoàn thành', cls: 'badge-booking-done' },
  COMPLETED: { label: 'Hoàn thành', cls: 'badge-booking-done' },
  CONFIRMED: { label: 'Đã xác nhận', cls: 'badge-booking-confirmed' },
  CHECKED_IN: { label: 'Đang sử dụng', cls: 'badge-booking-active' },
  CANCELLED: { label: 'Đã huỷ', cls: 'badge-booking-cancelled' },
  NO_SHOW: { label: 'No-show', cls: 'badge-booking-noshow' },
  PENDING_PAYMENT: { label: 'Chờ TT', cls: 'badge-booking-pending' },
  EXPIRED: { label: 'Hết hạn', cls: 'badge-booking-expired' },
};

>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
@Component({
  selector: 'app-customers',
  standalone: false,
  styleUrl: './customers.component.css',
  templateUrl: './customers.component.html',
})
<<<<<<< HEAD
export class CustomersComponent implements OnInit {
=======
export class CustomersComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly cdr = inject(ChangeDetectorRef, { optional: true });

  loading = false;
  actionLoading = false;
  toast: { type: 'success' | 'error' | 'info'; text: string } | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  pendingLockTarget: CustomerItem | null = null;

>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  searchTerm = '';
  selectedTierFilter: CustomerTier = 'ALL';
  selectedStatusFilter: CustomerStatus = 'ALL';
  activeTab: 'ALL' | 'ACTIVE' | 'LOCKED' = 'ALL';

<<<<<<< HEAD
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
=======
  currentPage = 1;
  readonly pageSize = 8;

  customers: CustomerItem[] = [
    this.buildCustomerFromRaw({
      _id: 'c1',
      full_name: 'Trần Minh Anh',
      email: 'minhanh@example.com',
      phone: '0901234567',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      loyalty: { points: 3250, coins: 650, tier: 'BAC' },
      bookingCount: 48,
      totalSpend: 32500000,
      created_at: '2026-03-15T00:00:00Z',
    }),
    this.buildCustomerFromRaw({
      _id: 'c2',
      full_name: 'Nguyễn Mai Anh',
      email: 'mai@example.com',
      phone: '0909876543',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      loyalty: { points: 450, coins: 120, tier: 'CHUA_DAT_HANG' },
      bookingCount: 5,
      totalSpend: 4500000,
      created_at: '2026-09-02T00:00:00Z',
    }),
    this.buildCustomerFromRaw({
      _id: 'c3',
      full_name: 'Lê Hoàng Nam',
      email: 'nam.le@example.com',
      phone: '0911223344',
      role: 'CUSTOMER',
      status: 'LOCKED',
      loyalty: { points: 6200, coins: 400, tier: 'VANG' },
      bookingCount: 22,
      totalSpend: 62000000,
      created_at: '2026-04-20T00:00:00Z',
    }),
  ];

  selectedCustomer: CustomerItem | null = null;

  private readonly onAdminRefresh = () => {
    this.loadCustomers();
  };

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('ken-admin-refresh', this.onAdminRefresh);
    }
    this.route?.queryParams.subscribe((params) => {
      if (params['q']) {
        this.searchTerm = params['q'];
      }
      this.loadCustomers(params['userId']);
    });
    if (!this.route) {
      this.loadCustomers();
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('ken-admin-refresh', this.onAdminRefresh);
    }
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  loadCustomers(preferredUserId?: string): void {
    if (!this.http) return;
    this.loading = true;
    const params = new HttpParams().set('limit', '100').set('page', '1');

    this.http
      .get<any>('/api/admin/users', { params })
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        this.loading = false;
        const rows = Array.isArray(res) ? res : res?.items || res?.users || res?.data || [];
        if (rows.length > 0 || res !== null) {
          this.customers = rows.map((u: any, idx: number) => this.buildCustomerFromRaw(u, idx));
          const target =
            (preferredUserId && this.customers.find((c) => c.id === preferredUserId)) ||
            (this.selectedCustomer && this.customers.find((c) => c.id === this.selectedCustomer?.id)) ||
            null;
          if (target) this.selectCustomer(target, true);
          else this.selectedCustomer = null;
        }
        this.currentPage = 1;
        this.cdr?.markForCheck();
      });
  }

  private buildCustomerFromRaw(u: any, idx = 0): CustomerItem {
    const id = String(u._id || u.id || `c-${idx + 1}`);
    const role = String(u.role || 'CUSTOMER').toUpperCase();
    const status: 'ACTIVE' | 'LOCKED' = String(u.status || 'ACTIVE').toUpperCase() === 'LOCKED' ? 'LOCKED' : 'ACTIVE';

    const points = Math.max(0, Number(u.loyalty?.points ?? u.points ?? 0));
    const coins = Math.max(0, Number(u.loyalty?.coins ?? u.coins ?? 0));
    const tierInfo = this.resolveTierInfo(points, u.loyalty?.tier || u.tier);

    const totalOrders = Number(u.bookingCount ?? u.totalOrders ?? 0);
    const totalSpend = Number(u.totalSpend ?? u.totalSpent ?? points * 10000);

    return {
      id,
      code: u.code || (role === 'ADMIN' ? 'ADMIN' : `KH-${id.slice(-4).toUpperCase()}`),
      name: u.full_name || u.name || 'Khách hàng',
      phone: u.phone || '—',
      email: u.email || '—',
      role,
      tier: tierInfo.name,
      tierKey: tierInfo.key,
      tierBadgeClass: tierInfo.badgeClass,
      points,
      pointsFormatted: points.toLocaleString('vi-VN'),
      coins,
      coinsFormatted: coins.toLocaleString('vi-VN'),
      status,
      statusLabel: status === 'LOCKED' ? 'Tạm khoá' : 'Hoạt động',
      statusBadgeClass: status === 'LOCKED' ? 'badge-status-locked' : 'badge-status-active',
      joinDate: u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : '—',
      totalOrders,
      totalSpend,
      totalSpendFormatted: `${Math.round(totalSpend).toLocaleString('vi-VN')}đ`,
      progressText: tierInfo.progressText,
      progressPercent: tierInfo.progressPercent,
      tierRange: tierInfo.tierRange,
      tierDiscount: tierInfo.tierDiscount,
      bookingHistory: [],
    };
  }

  /**
   * BR-H04: Chưa đạt hạng (<1.000đ: 0%), Bạc (1.000–<5.000đ: 5%), Vàng (5.000–<10.000đ: 10%), Kim Cương (>=10.000đ: 15%)
   */
  private resolveTierInfo(points: number, explicitTier?: string): {
    key: Exclude<CustomerTier, 'ALL'>;
    name: string;
    badgeClass: string;
    tierRange: string;
    tierDiscount: string;
    progressText: string;
    progressPercent: number;
  } {
    const raw = String(explicitTier || '').toUpperCase();
    if (raw === 'KIM_CUONG' || raw === 'DIAMOND' || points >= 10000) {
      return {
        key: 'KIM_CUONG',
        name: 'Kim Cương',
        badgeClass: 'badge-tier-diamond',
        tierRange: 'Kim Cương (>= 10.000 KÉN Điểm)',
        tierDiscount: 'Giảm 15% tổng hoá đơn',
        progressText: `${points.toLocaleString('vi-VN')} điểm · Đã đạt hạng cao nhất (Kim Cương)`,
        progressPercent: 100,
      };
    }
    if (raw === 'VANG' || raw === 'GOLD' || points >= 5000) {
      const pct = Math.min(100, Math.round(((points - 5000) / 5000) * 100));
      return {
        key: 'VANG',
        name: 'Vàng',
        badgeClass: 'badge-tier-gold',
        tierRange: 'Vàng (5.000 – 9.999 KÉN Điểm)',
        tierDiscount: 'Giảm 10% tổng hoá đơn',
        progressText: `${points.toLocaleString('vi-VN')} / 10.000 điểm để lên Kim Cương (${pct}%)`,
        progressPercent: pct,
      };
    }
    if (raw === 'BAC' || raw === 'SILVER' || points >= 1000) {
      const pct = Math.min(100, Math.round(((points - 1000) / 4000) * 100));
      return {
        key: 'BAC',
        name: 'Bạc',
        badgeClass: 'badge-tier-silver',
        tierRange: 'Bạc (1.000 – 4.999 KÉN Điểm)',
        tierDiscount: 'Giảm 5% tổng hoá đơn',
        progressText: `${points.toLocaleString('vi-VN')} / 5.000 điểm để lên Vàng (${pct}%)`,
        progressPercent: pct,
      };
    }
    const pct = Math.min(100, Math.round((points / 1000) * 100));
    return {
      key: 'CHUA_DAT_HANG',
      name: 'Chưa đạt hạng',
      badgeClass: 'badge-tier-none',
      tierRange: 'Chưa đạt hạng (< 1.000 KÉN Điểm)',
      tierDiscount: 'Chưa áp dụng giảm hạng (0%)',
      progressText: `${points.toLocaleString('vi-VN')} / 1.000 điểm để đạt hạng Bạc (${pct}%)`,
      progressPercent: pct,
    };
  }
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12

  get counts() {
    const active = this.customers.filter((c) => c.status === 'ACTIVE').length;
    const locked = this.customers.filter((c) => c.status === 'LOCKED').length;
    return { all: this.customers.length, active, locked };
  }

  get filteredCustomers(): CustomerItem[] {
<<<<<<< HEAD
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
=======
    const q = this.searchTerm.trim().toLowerCase();
    return this.customers.filter((c) => {
      const matchTab = this.activeTab === 'ALL' || c.status === this.activeTab;
      const matchTier = this.selectedTierFilter === 'ALL' || c.tierKey === this.selectedTierFilter;
      const matchStatus = this.selectedStatusFilter === 'ALL' || c.status === this.selectedStatusFilter;
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q);
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
      return matchTab && matchTier && matchStatus && matchSearch;
    });
  }

<<<<<<< HEAD
  selectCustomer(c: CustomerItem): void {
    this.selectedCustomer = c;
=======
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredCustomers.length / this.pageSize));
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const start = Math.max(1, Math.min(this.currentPage - 3, total - 6));
    const end = Math.min(total, start + 6);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  get pageStartIndex(): number {
    if (this.filteredCustomers.length === 0) return 0;
    const safePage = Math.min(this.currentPage, this.totalPages);
    return (safePage - 1) * this.pageSize + 1;
  }

  get pageEndIndex(): number {
    const safePage = Math.min(this.currentPage, this.totalPages);
    return Math.min(this.filteredCustomers.length, safePage * this.pageSize);
  }

  get paginatedCustomers(): CustomerItem[] {
    const safePage = Math.min(this.currentPage, this.totalPages);
    const start = (safePage - 1) * this.pageSize;
    return this.filteredCustomers.slice(start, start + this.pageSize);
  }

  selectCustomer(c: CustomerItem, forceOpen = false): void {
    if (!forceOpen && this.selectedCustomer?.id === c.id) {
      this.selectedCustomer = null;
      this.pendingLockTarget = null;
      return;
    }
    this.selectedCustomer = c;
    this.pendingLockTarget = null;
    this.loadCustomerBookings(c);
    if (!forceOpen && typeof document !== 'undefined') {
      setTimeout(() => {
        document.getElementById('customer-detail-anchor')?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }, 60);
    }
  }

  closeCustomerDetail(): void {
    this.selectedCustomer = null;
    this.pendingLockTarget = null;
  }

  private loadCustomerBookings(c: CustomerItem): void {
    if (!this.http || !/^[a-f0-9]{24}$/i.test(c.id)) return;
    this.http
      .get<any>(`/api/admin/users/${c.id}/bookings`)
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        const list = Array.isArray(res) ? res : res?.items || res?.bookings || res?.data || [];
        c.bookingHistory = list.map((b: any) => {
          const st = String(b.status || 'CONFIRMED').toUpperCase();
          const meta = BOOKING_STATUS_CLASS[st] || { label: st, cls: 'badge-booking-confirmed' };
          return {
            id: String(b._id || b.id || ''),
            code: b.booking_code || String(b._id || '').slice(-8).toUpperCase(),
            spaceName: b.space?.name || b.space_name || 'Không gian KÉN',
            date: b.start_at ? new Date(b.start_at).toLocaleDateString('vi-VN') : '—',
            status: meta.label,
            statusClass: meta.cls,
            totalAmount: Number(b.final_amount || 0),
          };
        });
        c.historyLoaded = true;
        this.cdr?.markForCheck();
      });
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  }

  setTab(tab: 'ALL' | 'ACTIVE' | 'LOCKED'): void {
    this.activeTab = tab;
<<<<<<< HEAD
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
=======
    this.currentPage = 1;
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedTierFilter = 'ALL';
    this.selectedStatusFilter = 'ALL';
    this.activeTab = 'ALL';
    this.currentPage = 1;
  }

  requestToggleLock(c: CustomerItem): void {
    if (c.role === 'ADMIN') {
      this.showToast('error', 'Không thể khoá hoặc mở khoá tài khoản Quản trị viên (ADMIN).');
      return;
    }
    this.pendingLockTarget = c;
  }

  confirmToggleLock(): void {
    const c = this.pendingLockTarget;
    if (!c) return;
    this.pendingLockTarget = null;

    const locking = c.status === 'ACTIVE';
    if (!this.http) {
      c.status = locking ? 'LOCKED' : 'ACTIVE';
      c.statusLabel = locking ? 'Tạm khoá' : 'Hoạt động';
      c.statusBadgeClass = locking ? 'badge-status-locked' : 'badge-status-active';
      this.showToast('success', locking ? `Đã tạm khoá ${c.name}.` : `Đã mở khoá ${c.name}.`);
      return;
    }

    this.actionLoading = true;
    const endpoint = locking ? `/api/admin/users/${c.id}/lock` : `/api/admin/users/${c.id}/unlock`;
    this.http.post<any>(endpoint, {}).subscribe({
      next: () => {
        this.actionLoading = false;
        c.status = locking ? 'LOCKED' : 'ACTIVE';
        c.statusLabel = locking ? 'Tạm khoá' : 'Hoạt động';
        c.statusBadgeClass = locking ? 'badge-status-locked' : 'badge-status-active';
        this.showToast(
          'success',
          locking
            ? `Đã tạm khoá tài khoản ${c.name} (lịch sử đặt chỗ được giữ nguyên).`
            : `Đã mở khoá tài khoản ${c.name}.`
        );
        this.cdr?.markForCheck();
      },
      error: (err) => {
        this.actionLoading = false;
        this.showToast('error', err?.error?.message || 'Không thể cập nhật trạng thái tài khoản.');
      },
    });
  }

  viewBooking(code: string): void {
    this.router?.navigate(['/admin/bookings'], { queryParams: { code } });
  }

  viewCustomerBookings(c: CustomerItem, event: Event): void {
    event.stopPropagation();
    this.router?.navigate(['/admin/bookings'], {
      queryParams: { q: c.phone && c.phone !== '—' ? c.phone : c.name },
    });
  }

  exportList(): void {
    if (typeof document === 'undefined') return;
    const header = ['Mã', 'Họ tên', 'Vai trò', 'Điện thoại', 'Email', 'Hạng', 'KÉN Điểm', 'KÉN Coins', 'Trạng thái', 'Số đơn', 'Chi tiêu'];
    const rows = this.filteredCustomers.map((c) => [
      c.code,
      c.name,
      c.role,
      c.phone,
      c.email,
      c.tier,
      String(c.points),
      String(c.coins),
      c.status,
      String(c.totalOrders),
      String(c.totalSpend),
    ]);
    const csv = '\uFEFF' + [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ken-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('success', `Đã xuất ${this.filteredCustomers.length} khách hàng ra CSV.`);
  }

  formatMoney(val: number): string {
    return `${Math.round(val || 0).toLocaleString('vi-VN')}đ`;
  }

  showToast(type: 'success' | 'error' | 'info', text: string): void {
    this.toast = { type, text };
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast = null;
      this.cdr?.markForCheck();
    }, 4500);
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  }
}

export { CustomersComponent as Customers };
