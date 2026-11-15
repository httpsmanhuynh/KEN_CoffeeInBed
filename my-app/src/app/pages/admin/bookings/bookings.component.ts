import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export type BookingFilterStatus =
  | 'ALL'
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'EXPIRED'
  | 'REFUND_PENDING';

export interface StatusLogRow {
  time: string;
  actor: string;
  fromStatus: string;
  toStatus: string;
  note?: string;
}

export interface BookingItemLine {
  name: string;
  detail: string;
  amount: number;
}

export interface BookingRow {
  id: string;
  code: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  tierLabel: string;
  discountLabel: string;
  spaceName: string;
  spaceType: 'EXCLUSIVE' | 'SHARED';
  bufferMinutes: number;
  zoneId: string;
  zoneName: string;
  packageName: string;
  startIso: string;
  endIso: string;
  date: string;
  dateIso: string;
  timeSlot: string;
  startHour: number;
  checkInEarliest: string;
  noShowThreshold: string;
  cleanupWindow: string;
  guestCount: number;
  packagePrice: number;
  inclusionSurcharge: number;
  addonTotal: number;
  voucherDiscount: number;
  tierDiscount: number;
  finalAmount: number;
  paymentStatus: string;
  paymentLabel: string;
  paymentTime: string;
  paymentMethod: string;
  txnCode: string;
  refundStatus: string;
  refundNote: string;
  refundAmount: number;
  status: string;
  statusLabel: string;
  statusBadgeClass: string;
  inclusions: BookingItemLine[];
  addons: BookingItemLine[];
  statusLogs: StatusLogRow[];
  estimatedPoints: number;
}

const STATUS_DISPLAY: Record<string, { label: string; badgeClass: string }> = {
  PENDING_PAYMENT: { label: 'Chờ thanh toán', badgeClass: 'badge-pending' },
  CONFIRMED: { label: 'Đã xác nhận', badgeClass: 'badge-confirmed' },
  CHECKED_IN: { label: 'Đang sử dụng', badgeClass: 'badge-checked-in' },
  CHECKED_OUT: { label: 'Hoàn thành', badgeClass: 'badge-completed' },
  COMPLETED: { label: 'Hoàn thành', badgeClass: 'badge-completed' },
  CANCELLED: { label: 'Đã huỷ', badgeClass: 'badge-cancelled' },
  NO_SHOW: { label: 'Khách không đến', badgeClass: 'badge-no-show' },
  EXPIRED: { label: 'Hết hạn giữ chỗ', badgeClass: 'badge-expired' },
};

const TIER_MAP: Record<string, { name: string; pct: string }> = {
  CHUA_DAT_HANG: { name: 'Chưa đạt hạng', pct: 'Không giảm' },
  BASIC: { name: 'Chưa đạt hạng', pct: 'Không giảm' },
  BAC: { name: 'Bạc', pct: 'Giảm 5%' },
  SILVER: { name: 'Bạc', pct: 'Giảm 5%' },
  VANG: { name: 'Vàng', pct: 'Giảm 10%' },
  GOLD: { name: 'Vàng', pct: 'Giảm 10%' },
  KIM_CUONG: { name: 'Kim Cương', pct: 'Giảm 15%' },
  DIAMOND: { name: 'Kim Cương', pct: 'Giảm 15%' },
};

@Component({
  selector: 'app-bookings',
  standalone: false,
  styleUrl: './bookings.component.css',
  templateUrl: './bookings.component.html',
})
export class BookingsComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly cdr = inject(ChangeDetectorRef, { optional: true });

  loading = false;
  actionLoading = false;
  toast: { type: 'success' | 'error' | 'info'; text: string } | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  confirmAction: { type: 'NO_SHOW'; booking: BookingRow } | null = null;
  reconcileNote = '';

  selectedFilter: BookingFilterStatus = 'ALL';
  searchTerm = '';
  selectedDate = '';
  selectedTimeSlot: 'ALL' | 'MORNING' | 'AFTERNOON' | 'EVENING' = 'ALL';
  selectedZone = 'ALL';
  selectedPaymentFilter: 'ALL' | 'PAID' | 'UNPAID' | 'REFUND_PENDING' = 'ALL';

  currentPage = 1;
  readonly pageSize = 8;

  zones: Array<{ id: string; name: string }> = [
    { id: 'tap-trung', name: 'KÉN Tập Trung' },
    { id: 'tai-tao', name: 'KÉN Tái Tạo' },
  ];

  bookings: BookingRow[] = [
    {
      id: 'b1',
      code: 'KEN-241026-001',
      customerName: 'Trần Minh Anh',
      customerEmail: 'minhanh@example.com',
      customerPhone: '0901234567',
      tierLabel: 'Bạc',
      discountLabel: 'Giảm 5%',
      spaceName: 'Focus Pod',
      spaceType: 'EXCLUSIVE',
      bufferMinutes: 15,
      zoneId: 'tap-trung',
      zoneName: 'KÉN Tập Trung',
      packageName: 'Nửa ngày · 4 giờ',
      startIso: '2026-10-24T09:00:00+07:00',
      endIso: '2026-10-24T13:00:00+07:00',
      date: '24/10/2026',
      dateIso: '2026-10-24',
      timeSlot: '09:00–13:00',
      startHour: 9,
      checkInEarliest: '08:45',
      noShowThreshold: '09:30',
      cleanupWindow: '13:00–13:15 (15 phút dọn ô)',
      guestCount: 1,
      packagePrice: 140000,
      inclusionSurcharge: 5000,
      addonTotal: 0,
      voucherDiscount: 0,
      tierDiscount: 7250,
      finalAmount: 137750,
      paymentStatus: 'PAID',
      paymentLabel: 'Đã thanh toán',
      paymentTime: '08:42 · 24/10/2026',
      paymentMethod: 'Chuyển khoản QR',
      txnCode: 'TXN-001-2026',
      refundStatus: 'NONE',
      refundNote: '',
      refundAmount: 0,
      status: 'CHECKED_IN',
      statusLabel: 'Đang sử dụng',
      statusBadgeClass: 'badge-checked-in',
      inclusions: [{ name: 'Matcha Latte Đá', detail: 'Hỗ trợ 50.000đ · Phụ thu 5.000đ', amount: 5000 }],
      addons: [],
      statusLogs: [
        { time: '24/10/2026 08:42', actor: 'Hệ thống', fromStatus: 'PENDING_PAYMENT', toStatus: 'CONFIRMED', note: 'Thanh toán thành công' },
        { time: '24/10/2026 08:55', actor: 'Admin Quầy', fromStatus: 'CONFIRMED', toStatus: 'CHECKED_IN', note: 'Check-in đúng khung giờ' },
      ],
      estimatedPoints: 13,
    },
    {
      id: 'b2',
      code: 'KEN-241026-002',
      customerName: 'Nguyễn Mai Anh',
      customerEmail: 'mai@example.com',
      customerPhone: '0909876543',
      tierLabel: 'Chưa đạt hạng',
      discountLabel: 'Không giảm',
      spaceName: 'Work Lounge',
      spaceType: 'SHARED',
      bufferMinutes: 0,
      zoneId: 'tap-trung',
      zoneName: 'KÉN Tập Trung',
      packageName: 'Linh hoạt · 1 giờ',
      startIso: '2026-10-24T10:00:00+07:00',
      endIso: '2026-10-24T11:00:00+07:00',
      date: '24/10/2026',
      dateIso: '2026-10-24',
      timeSlot: '10:00–11:00',
      startHour: 10,
      checkInEarliest: '09:45',
      noShowThreshold: '10:30',
      cleanupWindow: '0 phút (Không gian SHARED)',
      guestCount: 1,
      packagePrice: 35000,
      inclusionSurcharge: 0,
      addonTotal: 0,
      voucherDiscount: 0,
      tierDiscount: 0,
      finalAmount: 35000,
      paymentStatus: 'PAID',
      paymentLabel: 'Đã thanh toán',
      paymentTime: '09:20 · 24/10/2026',
      paymentMethod: 'Ví MoMo',
      txnCode: 'TXN-002-2026',
      refundStatus: 'NONE',
      refundNote: '',
      refundAmount: 0,
      status: 'CONFIRMED',
      statusLabel: 'Đã xác nhận',
      statusBadgeClass: 'badge-confirmed',
      inclusions: [{ name: 'Trà Đào Cam Sả', detail: 'Trong chuẩn 50.000đ', amount: 0 }],
      addons: [],
      statusLogs: [
        { time: '24/10/2026 09:20', actor: 'Hệ thống', fromStatus: 'PENDING_PAYMENT', toStatus: 'CONFIRMED', note: 'Khách đã thanh toán' },
      ],
      estimatedPoints: 3,
    },
  ];

  selectedBooking: BookingRow | null = this.bookings[0];

  private readonly onAdminRefresh = () => {
    this.loadBookings();
  };

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('ken-admin-refresh', this.onAdminRefresh);
    }
    this.route?.queryParams.subscribe((params) => {
      if (params['code']) this.searchTerm = params['code'];
      if (params['status']) {
        const st = String(params['status']).toUpperCase() as BookingFilterStatus;
        this.selectedFilter = st;
      }
      if (params['refundStatus'] === 'PENDING_ACTION') {
        this.selectedFilter = 'REFUND_PENDING';
      }
      this.loadBookings();
    });
    if (!this.route) {
      this.loadBookings();
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('ken-admin-refresh', this.onAdminRefresh);
    }
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  loadBookings(): void {
    if (!this.http) return;
    this.loading = true;

    let params = new HttpParams().set('limit', '120');
    if (this.selectedDate) params = params.set('date', this.selectedDate);
    if (this.selectedZone !== 'ALL') params = params.set('zoneId', this.selectedZone);

    forkJoin({
      bookings: this.http.get<any>('/api/bookings', { params }).pipe(catchError(() => of(null))),
      zones: this.http.get<any>('/api/zones?all=true').pipe(catchError(() => of(null))),
    }).subscribe((res) => {
      this.loading = false;

      const rawZones = this.extractList(res.zones);
      if (rawZones.length > 0) {
        this.zones = rawZones.map((z: any) => ({
          id: String(z._id || z.id),
          name: z.name || z.code || 'Khu vực',
        }));
      }

      const rawBookings = this.extractList(res.bookings);
      if (rawBookings.length > 0 || res.bookings !== null) {
        this.bookings = rawBookings.map((b: any) => this.mapApiBooking(b));
        const matchCode = this.searchTerm.trim().toLowerCase();
        const found =
          (matchCode && this.bookings.find((x) => x.code.toLowerCase() === matchCode)) ||
          (this.selectedBooking && this.bookings.find((x) => x.id === this.selectedBooking?.id)) ||
          this.filteredBookings[0] ||
          this.bookings[0] ||
          null;
        this.selectedBooking = found;
        if (found) this.loadBookingDetail(found.id);
      }

      this.currentPage = 1;
      this.cdr?.markForCheck();
    });
  }

  private extractList(payload: any): any[] {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    return payload.items || payload.bookings || payload.data || [];
  }

  private mapApiBooking(b: any): BookingRow {
    const startAt = b.start_at ? new Date(b.start_at) : null;
    const endAt = b.end_at ? new Date(b.end_at) : null;
    const validStart = startAt && !Number.isNaN(startAt.getTime());
    const validEnd = endAt && !Number.isNaN(endAt.getTime());

    const fmtTime = (d: Date | null) =>
      d ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
    const addMins = (d: Date | null, m: number) => (d ? fmtTime(new Date(d.getTime() + m * 60000)) : '--:--');

    const date = validStart ? startAt.toLocaleDateString('vi-VN') : '—';
    const dateIso = validStart ? new Date(startAt.getTime() + 7 * 3600000).toISOString().slice(0, 10) : '';
    const startHour = validStart ? new Date(startAt.getTime() + 7 * 3600000).getUTCHours() : 9;
    const timeSlot = validStart && validEnd ? `${fmtTime(startAt)}–${fmtTime(endAt)}` : '--:--';

    const spaceType = String(b.space?.type || b.space_type || 'EXCLUSIVE').toUpperCase() === 'SHARED' ? 'SHARED' : 'EXCLUSIVE';
    const bufferMinutes = Number(b.buffer_minutes ?? b.space?.buffer_minutes ?? (spaceType === 'EXCLUSIVE' ? 15 : 0));
    const cleanupWindow =
      bufferMinutes > 0 && validEnd
        ? `${fmtTime(endAt)}–${addMins(endAt, bufferMinutes)} (${bufferMinutes} phút dọn ô)`
        : '0 phút (Không gian SHARED)';

    const rawStatus = String(b.status || 'CONFIRMED').toUpperCase();
    const statusNorm = rawStatus === 'COMPLETED' ? 'CHECKED_OUT' : rawStatus;
    const meta = STATUS_DISPLAY[statusNorm] || { label: statusNorm, badgeClass: 'badge-confirmed' };

    const tierRaw = String(b.tier_snapshot || b.user?.tier || 'CHUA_DAT_HANG').toUpperCase();
    const tierInfo = TIER_MAP[tierRaw] || { name: tierRaw, pct: 'Theo hạng' };

    const finalAmount = Number(b.final_amount ?? 0);
    const payStatus = String(b.payment_status || 'UNPAID').toUpperCase();
    const refundStatus = String(b.refund_status || 'NONE').toUpperCase();

    return {
      id: String(b._id || b.id),
      code: b.booking_code || String(b._id || '').slice(-8).toUpperCase(),
      customerId: b.user_id ? String(b.user_id) : undefined,
      customerName: b.customer_name || b.user?.full_name || 'Khách hàng',
      customerEmail: b.customer_email || b.user?.email || '—',
      customerPhone: b.customer_phone || b.user?.phone || '—',
      tierLabel: tierInfo.name,
      discountLabel: b.tier_discount ? `-${this.formatMoney(b.tier_discount)}` : tierInfo.pct,
      spaceName: b.space?.name || b.space_name || 'Không gian KÉN',
      spaceType,
      bufferMinutes,
      zoneId: String(b.zone_id || b.space?.zone_id || ''),
      zoneName: b.zone?.name || b.zone_name || 'Khu vực KÉN',
      packageName: b.package?.name || b.package_name || 'Gói tiêu chuẩn',
      startIso: b.start_at || '',
      endIso: b.end_at || '',
      date,
      dateIso,
      timeSlot,
      startHour,
      checkInEarliest: addMins(validStart ? startAt : null, -15),
      noShowThreshold: addMins(validStart ? startAt : null, 30),
      cleanupWindow,
      guestCount: Number(b.guest_count || 1),
      packagePrice: Number(b.package_price || 0),
      inclusionSurcharge: Number(b.inclusion_surcharge || 0),
      addonTotal: Number(b.addon_total || 0),
      voucherDiscount: Number(b.voucher_discount || 0),
      tierDiscount: Number(b.tier_discount || 0),
      finalAmount,
      paymentStatus: payStatus,
      paymentLabel:
        payStatus === 'PAID'
          ? 'Đã thanh toán'
          : payStatus === 'REFUNDED'
            ? 'Đã hoàn tiền'
            : payStatus === 'PENDING'
              ? 'Đang chờ'
              : 'Chưa thanh toán',
      paymentTime: b.paid_at ? new Date(b.paid_at).toLocaleString('vi-VN') : '—',
      paymentMethod: b.payment_method || 'Chuyển khoản / QR',
      txnCode: b.txn_code || b.transaction_ref || '—',
      refundStatus,
      refundNote: b.refund_note || '',
      refundAmount: Number(b.refund_amount ?? 0),
      status: statusNorm,
      statusLabel: meta.label,
      statusBadgeClass: meta.badgeClass,
      inclusions: Array.isArray(b.inclusions)
        ? b.inclusions.map((i: any) => ({
            name: i.item_name || i.name || 'Món đi kèm',
            detail: i.surcharge > 0 ? `Phụ thu vượt 50k: +${this.formatMoney(i.surcharge)}` : 'Hỗ trợ chuẩn gói',
            amount: Number(i.surcharge || 0),
          }))
        : [],
      addons: Array.isArray(b.addons)
        ? b.addons.map((a: any) => ({
            name: a.addon_name || a.name || 'Add-on',
            detail: `SL ${a.qty || a.quantity || 1} × ${this.formatMoney(a.unit_price || a.price || 0)}`,
            amount: Number(a.line_total ?? (Number(a.qty || 1) * Number(a.unit_price || 0))),
          }))
        : [],
      statusLogs: Array.isArray(b.status_logs)
        ? b.status_logs.map((l: any) => ({
            time: l.created_at ? new Date(l.created_at).toLocaleString('vi-VN') : '—',
            actor: l.actor_role || l.actor_name || 'Hệ thống',
            fromStatus: l.from_status || '—',
            toStatus: l.to_status || '—',
            note: l.note || '',
          }))
        : [],
      estimatedPoints: Math.floor(finalAmount / 10000),
    };
  }

  get statusCounts() {
    const counts = {
      all: this.bookings.length,
      pendingPayment: 0,
      confirmed: 0,
      checkedIn: 0,
      checkedOut: 0,
      cancelled: 0,
      noShow: 0,
      expired: 0,
      refundPending: 0,
    };
    for (const b of this.bookings) {
      if (b.status === 'PENDING_PAYMENT') counts.pendingPayment += 1;
      else if (b.status === 'CONFIRMED') counts.confirmed += 1;
      else if (b.status === 'CHECKED_IN') counts.checkedIn += 1;
      else if (b.status === 'CHECKED_OUT') counts.checkedOut += 1;
      else if (b.status === 'CANCELLED') {
        counts.cancelled += 1;
        if (['PROCESSING', 'FAILED', 'PENDING'].includes(b.refundStatus)) {
          counts.refundPending += 1;
        }
      } else if (b.status === 'NO_SHOW') counts.noShow += 1;
      else if (b.status === 'EXPIRED') counts.expired += 1;
    }
    return counts;
  }

  get filteredBookings(): BookingRow[] {
    const q = this.searchTerm.trim().toLowerCase();
    return this.bookings.filter((b) => {
      if (this.selectedFilter === 'REFUND_PENDING') {
        if (!(b.status === 'CANCELLED' && ['PROCESSING', 'FAILED', 'PENDING'].includes(b.refundStatus))) {
          return false;
        }
      } else if (this.selectedFilter !== 'ALL' && b.status !== this.selectedFilter) {
        return false;
      }

      if (this.selectedZone !== 'ALL' && b.zoneId && b.zoneId !== this.selectedZone) {
        return false;
      }

      if (this.selectedTimeSlot !== 'ALL') {
        if (this.selectedTimeSlot === 'MORNING' && b.startHour >= 12) return false;
        if (this.selectedTimeSlot === 'AFTERNOON' && (b.startHour < 12 || b.startHour >= 17)) return false;
        if (this.selectedTimeSlot === 'EVENING' && b.startHour < 17) return false;
      }

      if (this.selectedPaymentFilter === 'PAID' && b.paymentStatus !== 'PAID') return false;
      if (this.selectedPaymentFilter === 'UNPAID' && b.paymentStatus === 'PAID') return false;
      if (
        this.selectedPaymentFilter === 'REFUND_PENDING' &&
        !['PROCESSING', 'FAILED', 'PENDING'].includes(b.refundStatus)
      ) {
        return false;
      }

      if (q) {
        const hit =
          b.code.toLowerCase().includes(q) ||
          b.customerName.toLowerCase().includes(q) ||
          b.customerEmail.toLowerCase().includes(q) ||
          b.customerPhone.toLowerCase().includes(q) ||
          b.spaceName.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredBookings.length / this.pageSize));
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
    if (this.filteredBookings.length === 0) return 0;
    const safePage = Math.min(this.currentPage, this.totalPages);
    return (safePage - 1) * this.pageSize + 1;
  }

  get pageEndIndex(): number {
    const safePage = Math.min(this.currentPage, this.totalPages);
    return Math.min(this.filteredBookings.length, safePage * this.pageSize);
  }

  get paginatedBookings(): BookingRow[] {
    const safePage = Math.min(this.currentPage, this.totalPages);
    const start = (safePage - 1) * this.pageSize;
    return this.filteredBookings.slice(start, start + this.pageSize);
  }

  get needsRefundReconcile(): boolean {
    if (!this.selectedBooking) return false;
    return (
      this.selectedBooking.status === 'CANCELLED' &&
      ['PROCESSING', 'FAILED', 'PENDING'].includes(this.selectedBooking.refundStatus)
    );
  }

  selectBooking(b: BookingRow, scrollToDetail = false): void {
    this.selectedBooking = b;
    this.confirmAction = null;
    this.reconcileNote = '';
    this.loadBookingDetail(b.id);
    if (scrollToDetail && typeof document !== 'undefined') {
      setTimeout(() => {
        document.getElementById('booking-detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
    }
  }

  private loadBookingDetail(bookingId: string): void {
    if (!this.http || !/^[a-f0-9]{24}$/i.test(bookingId)) return;
    this.http.get<any>(`/api/bookings/${bookingId}`).subscribe({
      next: (raw) => {
        const b = raw?.booking || raw;
        if (!b || (!b._id && !b.id)) return;
        const mapped = this.mapApiBooking(b);
        const idx = this.bookings.findIndex((x) => x.id === mapped.id);
        if (idx >= 0) this.bookings[idx] = mapped;
        if (this.selectedBooking?.id === mapped.id) {
          this.selectedBooking = mapped;
        }
        this.cdr?.markForCheck();
      },
      error: () => {
        // Keep summary row on detail failure
      },
    });
  }

  filterByStatus(status: BookingFilterStatus): void {
    this.selectedFilter = status;
    this.currentPage = 1;
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
  }

  resetFilters(): void {
    this.selectedFilter = 'ALL';
    this.searchTerm = '';
    this.selectedDate = '';
    this.selectedTimeSlot = 'ALL';
    this.selectedZone = 'ALL';
    this.selectedPaymentFilter = 'ALL';
    this.currentPage = 1;
    this.loadBookings();
  }

  handleCheckIn(booking: BookingRow): void {
    if (!this.http) {
      this.mutateStatusLocal(booking, 'CHECKED_IN', 'Check-in tại quầy (Demo)');
      return;
    }
    this.actionLoading = true;
    this.http.post<any>(`/api/bookings/${booking.id}/check-in`, {}).subscribe({
      next: () => {
        this.actionLoading = false;
        this.showToast('success', `Check-in thành công đơn ${booking.code} (${booking.customerName}).`);
        this.loadBookings();
      },
      error: (err) => {
        this.actionLoading = false;
        this.showToast('error', err?.error?.message || `Không thể check-in đơn ${booking.code}.`);
      },
    });
  }

  handleCheckOut(booking: BookingRow): void {
    if (!this.http) {
      this.mutateStatusLocal(
        booking,
        'CHECKED_OUT',
        `Check-out thành công (+${booking.estimatedPoints} KÉN Điểm & Coins)`
      );
      return;
    }
    this.actionLoading = true;
    this.http.post<any>(`/api/bookings/${booking.id}/check-out`, {}).subscribe({
      next: (res) => {
        this.actionLoading = false;
        const pts = res?.pointsAwarded ?? booking.estimatedPoints;
        this.showToast('success', `Check-out thành công đơn ${booking.code}! Đã cộng +${pts} KÉN Điểm & Coins.`);
        this.loadBookings();
      },
      error: (err) => {
        this.actionLoading = false;
        this.showToast('error', err?.error?.message || `Không thể check-out đơn ${booking.code}.`);
      },
    });
  }

  requestNoShow(booking: BookingRow): void {
    this.confirmAction = { type: 'NO_SHOW', booking };
  }

  confirmNoShow(): void {
    if (!this.confirmAction) return;
    const booking = this.confirmAction.booking;
    this.confirmAction = null;

    if (!this.http) {
      this.mutateStatusLocal(booking, 'NO_SHOW', 'Xác nhận No-show (> +30p)');
      return;
    }
    this.actionLoading = true;
    this.http.post<any>(`/api/bookings/${booking.id}/no-show`, {}).subscribe({
      next: () => {
        this.actionLoading = false;
        this.showToast('info', `Đã ghi nhận NO_SHOW cho đơn ${booking.code} (phí 100%, 0 điểm).`);
        this.loadBookings();
      },
      error: (err) => {
        this.actionLoading = false;
        this.showToast('error', err?.error?.message || `Không thể đánh dấu No-show đơn ${booking.code}.`);
      },
    });
  }

  submitRefundReconcile(actionType: 'MANUAL_RESOLVE' | 'REPORT_DISCREPANCY'): void {
    if (!this.selectedBooking) return;
    const note = this.reconcileNote.trim();
    if (!note) {
      this.showToast('error', 'Vui lòng nhập ghi chú đối soát hoặc mã giao dịch ngân hàng.');
      return;
    }

    if (!this.http) {
      this.selectedBooking.refundStatus =
        actionType === 'MANUAL_RESOLVE' ? 'MANUALLY_RESOLVED' : 'DISCREPANCY_REPORTED';
      this.selectedBooking.refundNote = note;
      this.reconcileNote = '';
      this.showToast('success', `Đã cập nhật đối soát hoàn tiền (${actionType}).`);
      return;
    }

    this.actionLoading = true;
    const body =
      actionType === 'REPORT_DISCREPANCY' ? { note, action: 'REPORT_DISCREPANCY' } : { note };
    this.http.post<any>(`/api/bookings/${this.selectedBooking.id}/refund-reconcile`, body).subscribe({
      next: () => {
        this.actionLoading = false;
        this.reconcileNote = '';
        this.showToast(
          'success',
          actionType === 'REPORT_DISCREPANCY'
            ? 'Đã ghi nhận báo cáo sai lệch đối soát để bộ phận kế toán xử lý.'
            : 'Đã xác nhận hoàn tiền thủ công và cập nhật doanh thu thuần.'
        );
        this.loadBookings();
      },
      error: (err) => {
        this.actionLoading = false;
        this.showToast('error', err?.error?.message || 'Lỗi khi đối soát hoàn tiền.');
      },
    });
  }

  expireHolds(): void {
    if (!this.http) {
      this.showToast('info', 'Đã kiểm tra các đơn PENDING_PAYMENT quá hạn giữ chỗ.');
      return;
    }
    this.actionLoading = true;
    this.http.post<any>('/api/bookings/expire-holds', {}).subscribe({
      next: (res) => {
        this.actionLoading = false;
        const count = res?.expiredCount ?? res?.modifiedCount ?? 0;
        this.showToast('success', `Đã giải phóng ${count} đơn giữ chỗ quá hạn thanh toán (EXPIRED).`);
        this.loadBookings();
      },
      error: (err) => {
        this.actionLoading = false;
        this.showToast('error', err?.error?.message || 'Không thể chạy quét giữ chỗ quá hạn.');
      },
    });
  }

  viewCustomerProfile(booking: BookingRow): void {
    const query = booking.customerEmail && booking.customerEmail !== '—' ? booking.customerEmail : booking.customerName;
    this.router?.navigate(['/admin/customers'], { queryParams: { q: query } });
  }

  exportCsv(): void {
    if (typeof document === 'undefined') return;
    const header = ['Mã đơn', 'Khách hàng', 'Email', 'Không gian', 'Khu vực', 'Ngày', 'Giờ', 'Khách', 'Tổng cuối', 'Thanh toán', 'Trạng thái', 'Hoàn tiền'];
    const rows = this.filteredBookings.map((b) => [
      b.code,
      b.customerName,
      b.customerEmail,
      b.spaceName,
      b.zoneName,
      b.date,
      b.timeSlot,
      String(b.guestCount),
      String(b.finalAmount),
      b.paymentLabel,
      b.status,
      b.refundStatus,
    ]);
    const csv = '\uFEFF' + [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ken-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('success', `Đã xuất ${this.filteredBookings.length} booking ra CSV.`);
  }

  private mutateStatusLocal(booking: BookingRow, newStatus: string, note: string): void {
    const meta = STATUS_DISPLAY[newStatus] || { label: newStatus, badgeClass: 'badge-confirmed' };
    const prev = booking.status;
    booking.status = newStatus;
    booking.statusLabel = meta.label;
    booking.statusBadgeClass = meta.badgeClass;
    booking.statusLogs.unshift({
      time: new Date().toLocaleString('vi-VN'),
      actor: 'Admin Quầy',
      fromStatus: prev,
      toStatus: newStatus,
      note,
    });
    this.showToast('success', `${booking.code}: ${note}`);
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
  }
}

export { BookingsComponent as Bookings };
