import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface DailyRevenueBar {
  label: string;
  fullDate: string;
  revenue: number;
  payment: number;
  refund: number;
  bookingsCount: number;
  formattedRevenue: string;
  heightPercent: number;
  isPeak?: boolean;
}

export interface DonutSegment {
  key: string;
  label: string;
  count: number;
  pct: number;
  color: string;
  dashArray: string;
  dashOffset: number;
}

export interface ZoneActivityCard {
  id: string;
  code: string;
  name: string;
  bookingCount: number;
  occupancyRate: number | null;
  occupiedHours: number;
  availableHours: number;
  revenue: number;
}

export interface RevenueBreakdownItem {
  label: string;
  amount: number;
  pct: number;
  color: string;
  isDiscount?: boolean;
}

export interface TopAddonRow {
  rank: number;
  name: string;
  code: string;
  qty: number;
  revenue: number;
}

export interface PriorityTask {
  id: string;
  index: string;
  title: string;
  description: string;
  actionText: string;
  route: string;
  queryParams?: Record<string, string>;
  tone?: 'warn' | 'info' | 'normal';
}

export interface UpcomingGuest {
  id: string;
  time: string;
  dateLabel: string;
  name: string;
  code: string;
  space: string;
  guests: string;
  paymentStatus: string;
  bookingStatus: string;
  canCheckIn: boolean;
  checkedIn?: boolean;
  timeNote?: string;
}

export interface ZoneOption {
  id: string;
  name: string;
}

interface DashboardApiResponse {
  range?: { fromDate?: string; toDate?: string; groupBy?: string };
  bookings?: { total?: number; byStatus?: Record<string, number> };
  occupancy?: { rate?: number | null; occupiedHours?: number; availableHours?: number };
  revenue?: {
    basis?: string;
    total?: number;
    breakdown?: {
      package?: number;
      inclusionSurcharge?: number;
      addon?: number;
      discount?: number;
    };
    collected?: { amount?: number; count?: number };
    refunded?: { amount?: number; count?: number };
  };
  pendingRefundsCount?: number;
  topAddons?: Array<{
    addonId?: string;
    itemId?: string;
    name?: string;
    code?: string;
    quantity?: number;
    qty?: number;
    bookings?: number;
    revenue?: number;
  }>;
  zones?: Array<{
    zoneId?: string | null;
    zoneCode?: string | null;
    name?: string;
    zoneName?: string;
    spaceCount?: number;
    bookings?: { total?: number; byStatus?: Record<string, number> };
    occupancy?: { rate?: number | null; occupiedHours?: number; availableHours?: number };
    bookingCount?: number;
    occupancyRate?: number | null;
    occupiedHours?: number;
    availableHours?: number;
    revenue?: number | { total?: number };
  }>;
  daily?: Array<{ date?: string; bookingsCount?: number; revenue?: number; payment?: number; refund?: number }>;
}

const STATUS_META: Array<{ key: string; label: string; color: string }> = [
  { key: 'CHECKED_OUT', label: 'Hoàn thành', color: '#4A3123' },
  { key: 'CONFIRMED', label: 'Đã xác nhận', color: '#D9A74A' },
  { key: 'CHECKED_IN', label: 'Đang sử dụng', color: '#5B8A62' },
  { key: 'PENDING_PAYMENT', label: 'Chờ thanh toán', color: '#8A9AA9' },
  { key: 'CANCELLED', label: 'Đã huỷ', color: '#BA5C48' },
  { key: 'NO_SHOW', label: 'No-show', color: '#9C8A7A' },
  { key: 'EXPIRED', label: 'Hết hạn giữ chỗ', color: '#CFC4B8' },
];

const DONUT_CIRCUMFERENCE = 471.24;

@Component({
  selector: 'app-dashboard',
  standalone: false,
  styleUrl: './dashboard.component.css',
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly cdr = inject(ChangeDetectorRef, { optional: true });

  selectedPeriod: 'today' | '7days' | 'month' | 'custom' = 'month';
  fromDate = this.offsetVnDate(-29);
  toDate = this.offsetVnDate(0);
  selectedZone = 'all';

  loading = false;
  errorMessage = '';
  lastUpdatedText = 'Dữ liệu khởi tạo';
  toast: { type: 'success' | 'error' | 'info'; text: string } | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  zoneOptions: ZoneOption[] = [
    { id: 'tap-trung', name: 'KÉN Tập Trung' },
    { id: 'tai-tao', name: 'KÉN Tái Tạo' },
    { id: 'ket-noi', name: 'KÉN Kết Nối' },
  ];

  // KPI metrics
  netRevenue = 2437750;
  collectedAmount = 2637750;
  collectedCount = 20;
  refundedAmount = 200000;
  refundedCount = 2;
  pendingRefundsCount = 0;
  totalBookings = 24;
  confirmedCount = 6;
  checkedInCount = 4;
  checkedOutCount = 10;
  occupancyRate: number | null = 64.5;
  occupiedHours = 38.7;
  availableHours = 60;

  yAxisTicks = ['900.000', '600.000', '300.000', '0đ'];
  hourlyData: DailyRevenueBar[] = [
    { label: '20/10', fullDate: '2026-10-20', revenue: 420000, payment: 420000, refund: 0, bookingsCount: 4, formattedRevenue: '420.000đ', heightPercent: 47 },
    { label: '21/10', fullDate: '2026-10-21', revenue: 360000, payment: 360000, refund: 0, bookingsCount: 3, formattedRevenue: '360.000đ', heightPercent: 40 },
    { label: '22/10', fullDate: '2026-10-22', revenue: 620000, payment: 620000, refund: 0, bookingsCount: 6, formattedRevenue: '620.000đ', heightPercent: 69 },
    { label: '23/10', fullDate: '2026-10-23', revenue: 400000, payment: 400000, refund: 0, bookingsCount: 4, formattedRevenue: '400.000đ', heightPercent: 44 },
    { label: '24/10', fullDate: '2026-10-24', revenue: 637750, payment: 837750, refund: 200000, bookingsCount: 7, formattedRevenue: '637.750đ', heightPercent: 71, isPeak: true },
  ];

  donutSegments: DonutSegment[] = [];
  revenueBreakdown: RevenueBreakdownItem[] = [];
  topAddons: TopAddonRow[] = [];

  zones: ZoneActivityCard[] = [
    {
      id: 'tap-trung',
      code: 'KEN_TAP_TRUNG',
      name: 'KÉN Tập Trung',
      bookingCount: 17,
      occupancyRate: 71.2,
      occupiedHours: 27,
      availableHours: 38,
      revenue: 1717750,
    },
    {
      id: 'tai-tao',
      code: 'KEN_TAI_TAO',
      name: 'KÉN Tái Tạo',
      bookingCount: 7,
      occupancyRate: 53.2,
      occupiedHours: 11.7,
      availableHours: 22,
      revenue: 720000,
    },
  ];

  tasks: PriorityTask[] = [
    {
      id: 'task-1',
      index: '01',
      title: 'Kiểm tra đơn xác nhận & khách sắp đến',
      description: 'Theo dõi lượt đặt chỗ đang CONFIRMED trong khung [-15p, +30p].',
      actionText: 'Mở Quản lý Booking →',
      route: '/admin/bookings',
      tone: 'info',
    },
    {
      id: 'task-2',
      index: '02',
      title: 'Quản lý trả chỗ & Check-out',
      description: 'Chốt giờ ra cho khách đang sử dụng và cộng KÉN Điểm tự động.',
      actionText: 'Xem lượt Đang sử dụng →',
      route: '/admin/bookings',
      queryParams: { status: 'CHECKED_IN' },
      tone: 'normal',
    },
    {
      id: 'task-3',
      index: '03',
      title: 'Rà soát kho nguyên vật liệu & Add-on',
      description: 'Kiểm tra món bán kèm và dự báo nguyên liệu ngày mai.',
      actionText: 'Mở Sản phẩm & Add-on →',
      route: '/admin/addons',
      tone: 'normal',
    },
  ];

  upcomingGuests: UpcomingGuest[] = [];

  private readonly onAdminRefresh = () => {
    this.loadDashboard();
  };

  constructor() {
    this.rebuildFallbackCharts();
  }

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('ken-admin-refresh', this.onAdminRefresh);
    }
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('ken-admin-refresh', this.onAdminRefresh);
    }
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  private offsetVnDate(offsetDays: number): string {
    const vnMs = Date.now() + 7 * 3600 * 1000 + offsetDays * 86400000;
    return new Date(vnMs).toISOString().slice(0, 10);
  }

  private rebuildFallbackCharts(): void {
    this.donutSegments = this.computeDonutSegments({
      CHECKED_OUT: 10,
      CONFIRMED: 6,
      CHECKED_IN: 4,
      PENDING_PAYMENT: 0,
      CANCELLED: 2,
      NO_SHOW: 2,
      EXPIRED: 0,
    }, 24);
    this.revenueBreakdown = [
      { label: 'Gói dịch vụ (Package)', amount: 1850000, pct: 70, color: '#4A3123' },
      { label: 'Phụ phí đồ uống vượt chuẩn', amount: 185000, pct: 7, color: '#A9763F' },
      { label: 'Add-on bán kèm', amount: 602750, pct: 23, color: '#5B8A62' },
      { label: 'Giảm giá (Voucher + Hạng)', amount: 200000, pct: 8, color: '#BA5C48', isDiscount: true },
    ];
  }

  setPeriod(period: 'today' | '7days' | 'month'): void {
    this.selectedPeriod = period;
    const today = this.offsetVnDate(0);
    if (period === 'today') {
      this.fromDate = today;
      this.toDate = today;
    } else if (period === '7days') {
      this.fromDate = this.offsetVnDate(-6);
      this.toDate = today;
    } else {
      this.fromDate = this.offsetVnDate(-29);
      this.toDate = today;
    }
    this.loadDashboard();
  }

  onDateChange(kind: 'from' | 'to', value: string): void {
    if (!value) return;
    if (kind === 'from') this.fromDate = value;
    else this.toDate = value;
    this.selectedPeriod = 'custom';
  }

  onZoneChange(zoneId: string): void {
    this.selectedZone = zoneId || 'all';
    this.loadDashboard();
  }

  applyFilters(): void {
    if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
      this.errorMessage = 'Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.';
      this.showToast('error', this.errorMessage);
      return;
    }
    this.loadDashboard();
  }

  resetFilters(): void {
    this.selectedPeriod = 'month';
    this.fromDate = this.offsetVnDate(-29);
    this.toDate = this.offsetVnDate(0);
    this.selectedZone = 'all';
    this.loadDashboard();
  }

  loadDashboard(): void {
    if (!this.http) return;

    if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
      this.errorMessage = 'Khoảng ngày lọc không hợp lệ (Từ ngày <= Đến ngày).';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    let params = new HttpParams()
      .set('from', this.fromDate)
      .set('to', this.toDate)
      .set('topAddons', '6')
      .set('groupBy', 'day');
    if (this.selectedZone !== 'all') {
      params = params.set('zoneId', this.selectedZone);
    }

    forkJoin({
      dashboard: this.http.get<DashboardApiResponse>('/api/admin/dashboard', { params }).pipe(
        catchError((err) => {
          this.errorMessage = err?.error?.message || 'Không thể tải báo cáo tổng quan từ máy chủ.';
          return of(null);
        })
      ),
      zones: this.http.get<any>('/api/zones?all=true').pipe(catchError(() => of(null))),
      confirmedBookings: this.http.get<any>('/api/bookings?status=CONFIRMED&limit=12').pipe(catchError(() => of(null))),
      checkedInBookings: this.http.get<any>('/api/bookings?status=CHECKED_IN&limit=8').pipe(catchError(() => of(null))),
      alerts: this.http.get<any>('/api/admin/forecast/alerts?status=OPEN').pipe(catchError(() => of(null))),
    }).subscribe((res) => {
      this.loading = false;

      const rawZones = Array.isArray(res.zones) ? res.zones : res.zones?.items || res.zones?.data || [];
      if (rawZones.length > 0) {
        this.zoneOptions = rawZones.map((z: any) => ({
          id: String(z._id || z.id),
          name: z.name || z.code || 'Khu vực',
        }));
      }

      if (res.dashboard) {
        this.applyDashboardPayload(res.dashboard);
      }

      const confirmedList = this.extractList(res.confirmedBookings);
      const checkedInList = this.extractList(res.checkedInBookings);
      const alertsList = this.extractList(res.alerts);

      this.upcomingGuests = confirmedList.slice(0, 6).map((b: any) => this.mapBookingToGuest(b));
      this.tasks = this.buildDynamicTasks(confirmedList, checkedInList, alertsList);

      const now = new Date();
      this.lastUpdatedText = `Cập nhật lúc ${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
      this.cdr?.markForCheck();
    });
  }

  private extractList(payload: any): any[] {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    return payload.items || payload.bookings || payload.data || [];
  }

  private applyDashboardPayload(data: DashboardApiResponse): void {
    const rev = data.revenue || {};
    const bd = rev.breakdown || {};
    const collected = rev.collected || {};
    const refunded = rev.refunded || {};
    const bk = data.bookings || {};
    const byStatus = bk.byStatus || {};
    const occ = data.occupancy || {};

    this.netRevenue = Number(rev.total || 0);
    this.collectedAmount = Number(collected.amount || 0);
    this.collectedCount = Number(collected.count || 0);
    this.refundedAmount = Number(refunded.amount || 0);
    this.refundedCount = Number(refunded.count || 0);
    this.pendingRefundsCount = Number(data.pendingRefundsCount || 0);

    this.totalBookings = Number(bk.total || 0);
    this.confirmedCount = Number(byStatus['CONFIRMED'] || 0);
    this.checkedInCount = Number(byStatus['CHECKED_IN'] || 0);
    this.checkedOutCount = Number(byStatus['CHECKED_OUT'] || 0);

    this.occupancyRate = occ.rate !== undefined && occ.rate !== null ? Number(occ.rate) : null;
    this.occupiedHours = Number(occ.occupiedHours || 0);
    this.availableHours = Number(occ.availableHours || 0);

    this.donutSegments = this.computeDonutSegments(byStatus, this.totalBookings);

    // Revenue bars (max 14 points shown nicely in chart)
    const rawDaily = Array.isArray(data.daily) ? data.daily : [];
    const slicedDaily = rawDaily.length > 14 ? rawDaily.slice(-14) : rawDaily;
    const maxRev = Math.max(1, ...slicedDaily.map((d) => Number(d.revenue || 0)));
    const niceCeiling = this.calcNiceCeiling(maxRev);
    this.yAxisTicks = [
      this.formatCompactMoney(niceCeiling),
      this.formatCompactMoney(Math.round((niceCeiling * 2) / 3)),
      this.formatCompactMoney(Math.round(niceCeiling / 3)),
      '0đ',
    ];

    this.hourlyData = slicedDaily.map((d) => {
      const amount = Number(d.revenue || 0);
      const payment = Number(d.payment || 0);
      const refund = Number(d.refund || 0);
      const dateStr = String(d.date || '');
      const parts = dateStr.split('-');
      const shortLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
      return {
        label: shortLabel,
        fullDate: dateStr,
        revenue: amount,
        payment,
        refund,
        bookingsCount: Number(d.bookingsCount || 0),
        formattedRevenue: this.formatCompactMoney(amount),
        heightPercent: amount > 0 ? Math.max(6, Math.round((amount / niceCeiling) * 100)) : 2,
        isPeak: amount > 0 && amount === Math.max(...slicedDaily.map((x) => Number(x.revenue || 0))),
      };
    });

    // Breakdown
    const pkgAmt = Number(bd.package || 0);
    const surAmt = Number(bd.inclusionSurcharge || 0);
    const addAmt = Number(bd.addon || 0);
    const discAmt = Number(bd.discount || 0);
    const gross = Math.max(1, pkgAmt + surAmt + addAmt);
    this.revenueBreakdown = [
      { label: 'Gói dịch vụ (Package)', amount: pkgAmt, pct: Math.round((pkgAmt / gross) * 100), color: '#4A3123' },
      { label: 'Phụ phí đồ uống vượt chuẩn', amount: surAmt, pct: Math.round((surAmt / gross) * 100), color: '#A9763F' },
      { label: 'Add-on bán kèm', amount: addAmt, pct: Math.round((addAmt / gross) * 100), color: '#5B8A62' },
      { label: 'Giảm giá (Voucher + Hạng)', amount: discAmt, pct: Math.round((discAmt / gross) * 100), color: '#BA5C48', isDiscount: true },
    ];

    this.topAddons = (data.topAddons || []).map((a: any, idx: number) => {
      const qty = Number(a.quantity ?? a.qty ?? 0);
      const bookingsCount = Number(a.bookings ?? 0);
      return {
        rank: idx + 1,
        name: a.name || a.code || 'Món bán kèm',
        code: a.code || (bookingsCount > 0 ? `${bookingsCount} đơn đặt kèm` : 'Dịch vụ & thực đơn KÉN'),
        qty,
        revenue: Number(a.revenue || 0),
      };
    });

    this.zones = (data.zones || [])
      .filter((z: any) => z.zoneId != null || Number(z.spaceCount || 0) > 0)
      .map((z: any) => {
        const occRate = z.occupancy?.rate ?? z.occupancyRate;
        const revVal = typeof z.revenue === 'object' && z.revenue !== null ? z.revenue.total : z.revenue;
        return {
          id: String(z.zoneId || z.zoneCode || ''),
          code: z.zoneCode || '',
          name: z.name || z.zoneName || 'Khu vực KÉN',
          bookingCount: Number(z.bookings?.total ?? z.bookingCount ?? 0),
          occupancyRate: occRate !== undefined && occRate !== null ? Number(occRate) : null,
          occupiedHours: Number(z.occupancy?.occupiedHours ?? z.occupiedHours ?? 0),
          availableHours: Number(z.occupancy?.availableHours ?? z.availableHours ?? 0),
          revenue: Number(revVal || 0),
        };
      });
  }

  private computeDonutSegments(byStatus: Record<string, number>, total: number): DonutSegment[] {
    const safeTotal = total > 0
      ? total
      : STATUS_META.reduce((s, m) => s + Number(byStatus[m.key] || 0), 0);

    let offset = 0;
    return STATUS_META.map((m) => {
      const count = Number(byStatus[m.key] || 0);
      const pct = safeTotal > 0 ? Math.round((count / safeTotal) * 100) : 0;
      const len = safeTotal > 0 ? (count / safeTotal) * DONUT_CIRCUMFERENCE : 0;
      const seg: DonutSegment = {
        key: m.key,
        label: m.label,
        count,
        pct,
        color: m.color,
        dashArray: `${len.toFixed(2)} ${DONUT_CIRCUMFERENCE}`,
        dashOffset: Number((-offset).toFixed(2)),
      };
      offset += len;
      return seg;
    });
  }

  private mapBookingToGuest(b: any): UpcomingGuest {
    const startAt = b.start_at ? new Date(b.start_at) : null;
    const validStart = startAt && !Number.isNaN(startAt.getTime());
    const time = validStart
      ? startAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '--:--';
    const dateLabel = validStart
      ? startAt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
      : '';
    const spaceName = b.space?.name || b.space_name || 'Không gian KÉN';
    const customerName = b.customer_name || b.user?.full_name || 'Khách đặt chỗ';
    const code = b.booking_code || String(b._id || '').slice(-8).toUpperCase();
    const guestCount = Number(b.guest_count || 1);

    return {
      id: String(b._id || code),
      time,
      dateLabel,
      name: customerName,
      code,
      space: spaceName,
      guests: `${guestCount} khách`,
      paymentStatus: b.payment_status === 'PAID' ? 'Đã thanh toán' : (b.payment_status || 'Đã thanh toán'),
      bookingStatus: 'Đã xác nhận',
      canCheckIn: true,
    };
  }

  private buildDynamicTasks(confirmed: any[], checkedIn: any[], alerts: any[]): PriorityTask[] {
    const list: PriorityTask[] = [];
    if (this.pendingRefundsCount > 0) {
      list.push({
        id: 'refund-reconcile',
        index: String(list.length + 1).padStart(2, '0'),
        title: `${this.pendingRefundsCount} giao dịch hoàn tiền cần đối soát`,
        description: 'Đơn huỷ đang chờ xử lý hoàn tiền, chưa trừ vào doanh thu thuần.',
        actionText: 'Đối soát hoàn tiền ngay →',
        route: '/admin/bookings',
        queryParams: { refundStatus: 'PENDING_ACTION' },
        tone: 'warn',
      });
    }

    if (confirmed.length > 0) {
      const first = confirmed[0];
      const code = first.booking_code || String(first._id || '');
      list.push({
        id: 'confirmed-checkin',
        index: String(list.length + 1).padStart(2, '0'),
        title: `${confirmed.length} đơn Đã xác nhận chờ Check-in`,
        description: `Gần nhất: ${first.customer_name || 'Khách'} (${code}) · Khung vào [-15p, +30p].`,
        actionText: 'Xử lý Check-in / No-show →',
        route: '/admin/bookings',
        queryParams: { status: 'CONFIRMED' },
        tone: 'info',
      });
    }

    if (checkedIn.length > 0) {
      const firstIn = checkedIn[0];
      list.push({
        id: 'checkedin-checkout',
        index: String(list.length + 1).padStart(2, '0'),
        title: `${checkedIn.length} đơn đang sử dụng tại quán`,
        description: `Gần nhất: ${firstIn.booking_code || ''} · Hoàn tất Check-out để cộng KÉN Điểm & Coins.`,
        actionText: 'Mở đơn Đang sử dụng →',
        route: '/admin/bookings',
        queryParams: { status: 'CHECKED_IN' },
        tone: 'normal',
      });
    }

    if (alerts.length > 0) {
      list.push({
        id: 'inventory-alerts',
        index: String(list.length + 1).padStart(2, '0'),
        title: `${alerts.length} cảnh báo tồn kho nguyên liệu`,
        description: 'Nguyên liệu dưới ngưỡng an toàn theo dự báo nhu cầu.',
        actionText: 'Mở Dự báo & Tồn kho →',
        route: '/admin/forecast',
        tone: 'warn',
      });
    }

    if (list.length < 3) {
      list.push({
        id: 'catalog-addons',
        index: String(list.length + 1).padStart(2, '0'),
        title: 'Kiểm tra thực đơn đồ uống & Add-on',
        description: 'Đảm bảo phụ phí đồ uống vượt 50.000đ và trạng thái mở bán chính xác.',
        actionText: 'Mở Sản phẩm & Add-on →',
        route: '/admin/addons',
        tone: 'normal',
      });
    }

    return list.slice(0, 4);
  }

  handleCheckIn(guest: UpcomingGuest): void {
    if (!this.http) {
      guest.canCheckIn = false;
      guest.checkedIn = true;
      guest.timeNote = 'Đã check-in (Demo)';
      this.showToast('success', `Đã check-in cho khách ${guest.name} (${guest.code}).`);
      return;
    }

    this.http.post<any>(`/api/bookings/${guest.id}/check-in`, {}).subscribe({
      next: () => {
        guest.canCheckIn = false;
        guest.checkedIn = true;
        guest.timeNote = `Đã vào lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
        this.showToast('success', `Check-in thành công đơn ${guest.code} (${guest.name}).`);
        this.loadDashboard();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Không thể check-in ngoài khung giờ [-15p, +30p] hoặc đơn đã đổi trạng thái.';
        this.showToast('error', `${guest.code}: ${msg}`);
      },
    });
  }

  navigateTask(task: PriorityTask): void {
    this.router?.navigate([task.route], task.queryParams ? { queryParams: task.queryParams } : undefined);
  }

  goToBookings(status?: string): void {
    this.router?.navigate(['/admin/bookings'], status ? { queryParams: { status } } : undefined);
  }

  goToSpaces(): void {
    this.router?.navigate(['/admin/spaces']);
  }

  goToAddons(): void {
    this.router?.navigate(['/admin/addons']);
  }

  exportReport(): void {
    if (typeof document === 'undefined') return;
    const rows = [
      ['Báo cáo Dashboard KÉN', `${this.fromDate} -> ${this.toDate}`],
      ['Doanh thu thuần (VND)', String(this.netRevenue)],
      ['Đã thu SUCCESS (VND)', String(this.collectedAmount)],
      ['Đã hoàn SUCCESS (VND)', String(this.refundedAmount)],
      ['Hoàn tiền chờ đối soát', String(this.pendingRefundsCount)],
      ['Tổng lượt đặt chỗ', String(this.totalBookings)],
      ['Tỷ lệ lấp đầy (%)', this.occupancyRate !== null ? String(this.occupancyRate) : 'Chưa đủ dữ liệu'],
      [],
      ['Khu vực', 'Số booking', 'Lấp đầy (%)', 'Giờ dùng', 'Giờ mở', 'Doanh thu (VND)'],
      ...this.zones.map((z) => [
        z.name,
        String(z.bookingCount),
        z.occupancyRate !== null ? String(z.occupancyRate) : 'N/A',
        String(z.occupiedHours),
        String(z.availableHours),
        String(z.revenue),
      ]),
      [],
      ['Ngày', 'Đã thu (VND)', 'Đã hoàn (VND)', 'Doanh thu thuần (VND)'],
      ...this.hourlyData.map((d) => [d.fullDate, String(d.payment), String(d.refund), String(d.revenue)]),
    ];

    const csv = '\uFEFF' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ken-dashboard-${this.fromDate}-to-${this.toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('success', `Đã xuất báo cáo CSV (${this.fromDate} → ${this.toDate}).`);
  }

  formatMoney(val: number): string {
    return `${Math.round(val || 0).toLocaleString('vi-VN')}đ`;
  }

  private formatCompactMoney(val: number): string {
    const n = Math.round(val || 0);
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1).replace(/\.0$/, '')}tr`;
    if (abs >= 1000) return `${sign}${Math.round(abs / 1000)}k`;
    return `${n}đ`;
  }

  private calcNiceCeiling(maxVal: number): number {
    if (maxVal <= 0) return 900000;
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
    return Math.ceil(maxVal / magnitude) * magnitude;
  }

  showToast(type: 'success' | 'error' | 'info', text: string): void {
    this.toast = { type, text };
    this.cdr?.markForCheck();
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast = null;
      this.cdr?.markForCheck();
    }, 4500);
  }
}

export { DashboardComponent as Dashboard };
