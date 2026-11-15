<<<<<<< HEAD
import { Component } from '@angular/core';

type DiscountType = 'Phần trăm' | 'Số tiền';
type VoucherStatus = 'ACTIVE' | 'PAUSED';

interface VoucherItem {
  code: string;
  description: string;
  type: DiscountType;
  discount: string;
  cap: string;
  minimum: string;
  start: string;
  end: string;
  used: number;
  limit: number;
  status: VoucherStatus;
  area: string;
=======
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { catchError, of } from 'rxjs';

type DiscountType = 'PERCENT' | 'FIXED_AMOUNT';
type VoucherStatus = 'ACTIVE' | 'INACTIVE';

interface VoucherItem {
  id: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderValue: number;
  coinsCost: number;
  redeemLimit: number;
  redeemCount: number;
  usageLimit: number;
  usageCount: number;
  validFrom: string; // YYYY-MM-DD
  validTo: string; // YYYY-MM-DD
  status: VoucherStatus;
  createdAt?: string;
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
}

interface VoucherForm {
  code: string;
  description: string;
<<<<<<< HEAD
  type: DiscountType;
  discount: string;
  cap: string;
  minimum: string;
  area: string;
}

@Component({
  selector: 'app-voucher',
  standalone: false,
  styleUrl: './voucher.css',
  templateUrl: './voucher.html',
})
export class Voucher {
  query = '';
  selectedStatus = 'Tất cả';
  selectedArea = 'Tất cả';
  selectedVoucher: VoucherItem;
  toastMessage: string | null = null;

  readonly vouchers: VoucherItem[] = [
    {
      code: 'WELCOME10',
      description: 'Chào bạn mới - giảm 10%',
      type: 'Phần trăm',
      discount: '10%',
      cap: 'Trần 50.000đ',
      minimum: '100.000đ',
      start: '01/10/2026',
      end: '31/12/2026',
      used: 0,
      limit: 100,
      status: 'ACTIVE',
      area: 'Mọi khu vực',
    },
    {
      code: 'GIAM30K',
      description: 'Giảm 30.000đ cho đơn từ 150.000đ',
      type: 'Số tiền',
      discount: '30.000đ',
      cap: '',
      minimum: '150.000đ',
      start: '01/10/2026',
      end: '31/12/2026',
      used: 0,
      limit: 50,
      status: 'ACTIVE',
      area: 'Mọi khu vực',
    },
    {
      code: 'TAITAO20',
      description: 'KÉN Tái Tạo - giảm 20%',
      type: 'Phần trăm',
      discount: '20%',
      cap: 'Trần 100.000đ',
      minimum: '200.000đ',
      start: '01/10/2026',
      end: '31/12/2026',
      used: 0,
      limit: 30,
      status: 'ACTIVE',
      area: 'KÉN Tái Tạo',
    },
  ];

  form: VoucherForm = this.toForm(this.vouchers[0]);

  constructor() {
    this.selectedVoucher = this.vouchers[0];
  }

  get filteredVouchers(): VoucherItem[] {
    const query = this.query.trim().toLowerCase();
    return this.vouchers.filter((voucher) => {
      const matchesQuery =
        !query ||
        voucher.code.toLowerCase().includes(query) ||
        voucher.description.toLowerCase().includes(query);
      const matchesStatus =
        this.selectedStatus === 'Tất cả' ||
        (this.selectedStatus === 'Đang hoạt động' && voucher.status === 'ACTIVE') ||
        (this.selectedStatus === 'Tạm ngưng' && voucher.status === 'PAUSED');
      const matchesArea = this.selectedArea === 'Tất cả' || voucher.area === this.selectedArea;
      return matchesQuery && matchesStatus && matchesArea;
    });
  }

  get activeCount(): number {
    return this.vouchers.filter((voucher) => voucher.status === 'ACTIVE').length;
  }

  selectVoucher(voucher: VoucherItem): void {
    this.selectedVoucher = voucher;
    this.form = this.toForm(voucher);
  }

  toggleStatus(voucher: VoucherItem): void {
    voucher.status = voucher.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    this.selectVoucher(voucher);
    this.showToast(voucher.status === 'ACTIVE' ? 'Đã mở bán voucher' : 'Đã tạm ngưng voucher');
  }

  saveVoucher(): void {
    Object.assign(this.selectedVoucher, {
      code: this.form.code.trim() || this.selectedVoucher.code,
      description: this.form.description.trim(),
      type: this.form.type,
      discount: this.form.discount,
      cap: this.form.cap,
      minimum: this.form.minimum,
      area: this.form.area,
    });
    this.showToast('Đã lưu thay đổi voucher');
  }

  formatUsed(voucher: VoucherItem): string {
    return `${voucher.used} / ${voucher.limit}`;
  }

  private toForm(voucher: VoucherItem): VoucherForm {
    return {
      code: voucher.code,
      description: voucher.description,
      type: voucher.type,
      discount: voucher.discount.replace('%', '').replace(/\./g, ''),
      cap: voucher.cap.replace('Trần ', '').replace('đ', '').replace(/\./g, ''),
      minimum: voucher.minimum.replace('đ', '').replace(/\./g, ''),
      area: voucher.area,
    };
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    window.setTimeout(() => (this.toastMessage = null), 2400);
=======
  discountType: DiscountType;
  discountValue: number;
  minOrderValue: number;
  coinsCost: number;
  redeemLimit: number;
  redeemCount: number;
  usageLimit: number;
  usageCount: number;
  validFrom: string;
  validTo: string;
  status: VoucherStatus;
}

@Component({
  selector: 'app-admin-voucher',
  standalone: false,
  templateUrl: './voucher.html',
  styleUrl: './voucher.css',
})
export class Voucher implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly cdr = inject(ChangeDetectorRef, { optional: true });

  loading = false;
  saving = false;
  usingFallback = false;
  toast = '';
  toastType: 'ok' | 'err' = 'ok';
  formError = '';

  search = '';
  statusFilter = 'Tất cả';
  typeFilter = 'Tất cả';

  currentPage = 1;
  readonly pageSize = 8;

  isCreating = false;
  selectedId = '';

  vouchers: VoucherItem[] = [];
  form: VoucherForm = this.emptyForm();

  private toastTimer?: ReturnType<typeof setTimeout>;
  private readonly refreshListener = () => this.loadVouchers(true);

  ngOnInit(): void {
    this.seedFallback(false);
    this.loadVouchers();
    if (typeof window !== 'undefined') {
      window.addEventListener('ken-admin-refresh', this.refreshListener);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('ken-admin-refresh', this.refreshListener);
    }
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  loadVouchers(showToastOnDone = false): void {
    if (!this.http) {
      this.usingFallback = true;
      return;
    }

    this.loading = true;
    this.http
      .get<any>('/api/vouchers?all=true')
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        this.loading = false;
        const rows = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : null;
        if (rows) {
          this.usingFallback = false;
          this.vouchers = rows.map((raw: any) => this.normalizeVoucher(raw));
          if (!this.isCreating) {
            const match = this.vouchers.find((v) => v.id === this.selectedId) ?? this.vouchers[0];
            if (match) {
              this.selectVoucher(match);
            } else {
              this.startCreate();
            }
          }
          if (showToastOnDone) {
            this.notify('Đã đồng bộ danh sách voucher từ máy chủ');
          }
        } else {
          this.usingFallback = true;
          if (!this.vouchers.length) {
            this.seedFallback(true);
          }
        }
        this.cdr?.markForCheck();
      });
  }

  private seedFallback(markFallback: boolean): void {
    this.usingFallback = markFallback;
    this.vouchers = [
      {
        id: 'v-kenwelcome',
        code: 'KENWELCOME15',
        description: 'Giảm 15% cho khách hàng đặt phòng lần đầu tại KÉN',
        discountType: 'PERCENT',
        discountValue: 15,
        minOrderValue: 120000,
        coinsCost: 0,
        redeemLimit: 0,
        redeemCount: 0,
        usageLimit: 500,
        usageCount: 142,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
        status: 'ACTIVE',
      },
      {
        id: 'v-pod30k',
        code: 'KENVIP30K',
        description: 'Ưu đãi giảm trực tiếp 30.000đ cho đơn từ 150.000đ',
        discountType: 'FIXED_AMOUNT',
        discountValue: 30000,
        minOrderValue: 150000,
        coinsCost: 300,
        redeemLimit: 200,
        redeemCount: 48,
        usageLimit: 250,
        usageCount: 39,
        validFrom: '2026-02-01',
        validTo: '2026-12-31',
        status: 'ACTIVE',
      },
      {
        id: 'v-night20',
        code: 'STUDY20',
        description: 'Giảm 20% khung giờ học tập và làm việc ban ngày',
        discountType: 'PERCENT',
        discountValue: 20,
        minOrderValue: 200000,
        coinsCost: 500,
        redeemLimit: 100,
        redeemCount: 17,
        usageLimit: 120,
        usageCount: 14,
        validFrom: '2026-03-01',
        validTo: '2026-11-30',
        status: 'INACTIVE',
      },
    ];
    if (this.vouchers.length && !this.selectedId) {
      this.selectVoucher(this.vouchers[0]);
    }
  }

  private normalizeVoucher(raw: any): VoucherItem {
    const discountType: DiscountType =
      String(raw?.discount_type ?? raw?.discountType ?? '').toUpperCase() === 'FIXED_AMOUNT'
        ? 'FIXED_AMOUNT'
        : 'PERCENT';
    const status: VoucherStatus =
      String(raw?.status ?? '').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

    return {
      id: String(raw?._id ?? raw?.id ?? raw?.code ?? ''),
      code: String(raw?.code ?? '').toUpperCase(),
      description: String(raw?.description ?? ''),
      discountType,
      discountValue: Number(raw?.discount_value ?? raw?.discountValue ?? 10),
      minOrderValue: Number(raw?.min_order_value ?? raw?.minOrderValue ?? 0),
      coinsCost: Number(raw?.coins_cost ?? raw?.coinsCost ?? 0),
      redeemLimit: Number(raw?.redeem_limit ?? raw?.redeemLimit ?? 0),
      redeemCount: Number(raw?.redeem_count ?? raw?.redeemed_count ?? raw?.redeemCount ?? 0),
      usageLimit: Number(raw?.usage_limit ?? raw?.usageLimit ?? 100),
      usageCount: Number(raw?.usage_count ?? raw?.used_count ?? raw?.usageCount ?? 0),
      validFrom: this.toDateInput(raw?.valid_from ?? raw?.validFrom, this.todayIso()),
      validTo: this.toDateInput(raw?.valid_to ?? raw?.validTo, this.plusDaysIso(30)),
      status,
      createdAt: raw?.created_at ? String(raw.created_at) : undefined,
    };
  }

  private toDateInput(value: unknown, fallback: string): string {
    if (!value) return fallback;
    const str = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.slice(0, 10);
    }
    const parsed = new Date(str);
    if (Number.isNaN(parsed.getTime())) return fallback;
    return parsed.toISOString().slice(0, 10);
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private plusDaysIso(days: number): string {
    return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  }

  private emptyForm(): VoucherForm {
    return {
      code: '',
      description: '',
      discountType: 'PERCENT',
      discountValue: 10,
      minOrderValue: 100000,
      coinsCost: 0,
      redeemLimit: 0,
      redeemCount: 0,
      usageLimit: 100,
      usageCount: 0,
      validFrom: this.todayIso(),
      validTo: this.plusDaysIso(30),
      status: 'ACTIVE',
    };
  }

  get filteredVouchers(): VoucherItem[] {
    const q = this.search.trim().toLowerCase();
    return this.vouchers.filter((v) => {
      if (q && !v.code.toLowerCase().includes(q) && !v.description.toLowerCase().includes(q)) {
        return false;
      }
      if (this.statusFilter === 'ACTIVE' && (v.status !== 'ACTIVE' || this.isExpired(v))) {
        return false;
      }
      if (this.statusFilter === 'INACTIVE' && v.status !== 'INACTIVE') {
        return false;
      }
      if (this.statusFilter === 'EXPIRED' && !this.isExpired(v)) {
        return false;
      }
      if (this.typeFilter === 'PERCENT' && v.discountType !== 'PERCENT') return false;
      if (this.typeFilter === 'FIXED_AMOUNT' && v.discountType !== 'FIXED_AMOUNT') return false;
      if (this.typeFilter === 'COIN' && v.coinsCost <= 0) return false;
      return true;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredVouchers.length / this.pageSize));
  }

  get paginatedVouchers(): VoucherItem[] {
    const safePage = Math.min(this.currentPage, this.totalPages);
    const start = (safePage - 1) * this.pageSize;
    return this.filteredVouchers.slice(start, start + this.pageSize);
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
    if (this.filteredVouchers.length === 0) return 0;
    const safePage = Math.min(this.currentPage, this.totalPages);
    return (safePage - 1) * this.pageSize + 1;
  }

  get pageEndIndex(): number {
    const safePage = Math.min(this.currentPage, this.totalPages);
    return Math.min(this.filteredVouchers.length, safePage * this.pageSize);
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
  }

  get activeCount(): number {
    return this.vouchers.filter((v) => v.status === 'ACTIVE' && !this.isExpired(v)).length;
  }

  get coinRedeemableCount(): number {
    return this.vouchers.filter((v) => v.coinsCost > 0).length;
  }

  get totalUsageCount(): number {
    return this.vouchers.reduce((sum, v) => sum + (v.usageCount || 0), 0);
  }

  get selectedVoucher(): VoucherItem | null {
    return this.vouchers.find((v) => v.id === this.selectedId) ?? null;
  }

  isExpired(v: Pick<VoucherItem, 'validTo'>): boolean {
    if (!v.validTo) return false;
    return v.validTo < this.todayIso();
  }

  selectVoucher(item: VoucherItem): void {
    this.isCreating = false;
    this.selectedId = item.id;
    this.formError = '';
    this.form = {
      code: item.code,
      description: item.description,
      discountType: item.discountType,
      discountValue: item.discountValue,
      minOrderValue: item.minOrderValue,
      coinsCost: item.coinsCost,
      redeemLimit: item.redeemLimit,
      redeemCount: item.redeemCount,
      usageLimit: item.usageLimit,
      usageCount: item.usageCount,
      validFrom: item.validFrom,
      validTo: item.validTo,
      status: item.status,
    };
  }

  startCreate(): void {
    this.isCreating = true;
    this.selectedId = '';
    this.formError = '';
    this.form = this.emptyForm();
  }

  resetForm(): void {
    this.formError = '';
    if (this.isCreating) {
      this.form = this.emptyForm();
      return;
    }
    const existing = this.selectedVoucher;
    if (existing) {
      this.selectVoucher(existing);
    }
  }

  onSearchInput(event: Event): void {
    this.search = (event.target as HTMLInputElement).value;
    this.currentPage = 1;
  }

  onStatusFilterChange(event: Event): void {
    this.statusFilter = (event.target as HTMLSelectElement).value;
    this.currentPage = 1;
  }

  onTypeFilterChange(event: Event): void {
    this.typeFilter = (event.target as HTMLSelectElement).value;
    this.currentPage = 1;
  }

  onFormText(field: 'code' | 'description' | 'validFrom' | 'validTo', event: Event): void {
    const val = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.form[field] = field === 'code' ? val.toUpperCase().replace(/\s+/g, '') : val;
    this.formError = '';
  }

  onFormNumber(
    field: 'discountValue' | 'minOrderValue' | 'coinsCost' | 'redeemLimit' | 'usageLimit',
    event: Event,
  ): void {
    const raw = (event.target as HTMLInputElement).value;
    const num = Number(raw);
    this.form[field] = Number.isFinite(num) && num >= 0 ? Math.trunc(num) : 0;
    if (field === 'coinsCost' && this.form.coinsCost === 0) {
      this.form.redeemLimit = 0;
    }
    if (field === 'coinsCost' && this.form.coinsCost > 0 && this.form.redeemLimit === 0) {
      this.form.redeemLimit = Math.min(100, Math.max(1, this.form.usageLimit || 100));
    }
    this.formError = '';
  }

  onDiscountTypeChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.form.discountType = val === 'FIXED_AMOUNT' ? 'FIXED_AMOUNT' : 'PERCENT';
    if (this.form.discountType === 'PERCENT' && this.form.discountValue > 100) {
      this.form.discountValue = 20;
    }
    if (this.form.discountType === 'FIXED_AMOUNT' && this.form.discountValue < 1000) {
      this.form.discountValue = 20000;
    }
    this.formError = '';
  }

  onFormStatusChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.form.status = val === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  }

  private validateForm(): string | null {
    const code = this.form.code.trim().toUpperCase();
    if (!code) return 'Vui lòng nhập mã Voucher.';
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
      return 'Mã Voucher chỉ gồm 3–30 ký tự A-Z, 0-9, "_" hoặc "-".';
    }
    if (!Number.isInteger(this.form.discountValue) || this.form.discountValue < 1) {
      return 'Giá trị giảm phải là số nguyên dương (>= 1).';
    }
    if (this.form.discountType === 'PERCENT' && this.form.discountValue > 100) {
      return 'Voucher giảm theo % không được vượt quá 100%.';
    }
    if (this.form.minOrderValue < 0) {
      return 'Đơn hàng tối thiểu không được âm.';
    }
    if (!this.form.validFrom || !this.form.validTo) {
      return 'Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.';
    }
    if (this.form.validFrom > this.form.validTo) {
      return 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.';
    }
    if (this.form.usageLimit < 1) {
      return 'Giới hạn lượt áp dụng (usageLimit) phải >= 1.';
    }
    if (this.form.coinsCost > 0 && this.form.redeemLimit < 1) {
      return 'Voucher đổi bằng KÉN Xu phải có giới hạn lượt đổi (redeemLimit >= 1).';
    }
    if (this.form.coinsCost > 0 && this.form.usageLimit < this.form.redeemLimit) {
      return 'Tổng lượt áp dụng tối đa phải lớn hơn hoặc bằng giới hạn lượt đổi xu.';
    }
    return null;
  }

  saveVoucher(): void {
    const err = this.validateForm();
    if (err) {
      this.formError = err;
      this.notify(err, 'err');
      return;
    }

    const effectiveRedeemLimit = this.form.coinsCost > 0 ? this.form.redeemLimit : 0;
    const effectiveUsageLimit = Math.max(this.form.usageLimit, effectiveRedeemLimit);

    const payload = {
      code: this.form.code.trim().toUpperCase().slice(0, 30),
      description: this.form.description.trim() || null,
      discountType: this.form.discountType,
      discountValue: Math.trunc(this.form.discountValue),
      minOrderValue: Math.trunc(this.form.minOrderValue),
      coinsCost: Math.trunc(this.form.coinsCost),
      redeemLimit: Math.trunc(effectiveRedeemLimit),
      usageLimit: Math.trunc(effectiveUsageLimit),
      validFrom: `${this.form.validFrom}T00:00:00.000Z`,
      validTo: `${this.form.validTo}T23:59:59.999Z`,
      status: this.form.status,
    };

    if (!this.http || this.usingFallback) {
      this.applyLocalSave(payload);
      return;
    }

    this.saving = true;
    this.formError = '';

    if (this.isCreating) {
      this.http.post<any>('/api/vouchers', payload).subscribe({
        next: (res) => {
          this.saving = false;
          const created = res?.voucher
            ? this.normalizeVoucher(res.voucher)
            : this.normalizeVoucher({ ...payload, _id: res?.id });
          this.vouchers = [created, ...this.vouchers];
          this.selectVoucher(created);
          this.notify(`Đã tạo voucher ${created.code}`);
          this.cdr?.markForCheck();
        },
        error: (httpErr) => {
          this.saving = false;
          const apiCode = httpErr?.error?.error || httpErr?.error?.code;
          const msg =
            httpErr?.status === 409 || apiCode === 'CODE_EXISTS'
              ? `Mã Voucher "${payload.code}" đã tồn tại trong hệ thống.`
              : httpErr?.error?.message || 'Không thể tạo voucher. Vui lòng kiểm tra lại.';
          this.formError = msg;
          this.notify(msg, 'err');
          this.cdr?.markForCheck();
        },
      });
      return;
    }

    const targetId = this.selectedId;
    this.http.patch<any>(`/api/vouchers/${targetId}`, payload).subscribe({
      next: () => {
        this.saving = false;
        this.vouchers = this.vouchers.map((v) =>
          v.id === targetId
            ? {
                ...v,
                description: payload.description ?? '',
                discountType: payload.discountType,
                discountValue: payload.discountValue,
                minOrderValue: payload.minOrderValue,
                coinsCost: payload.coinsCost,
                redeemLimit: payload.redeemLimit,
                usageLimit: payload.usageLimit,
                validFrom: this.form.validFrom,
                validTo: this.form.validTo,
                status: payload.status,
              }
            : v,
        );
        const updated = this.vouchers.find((v) => v.id === targetId);
        if (updated) this.selectVoucher(updated);
        this.notify(`Đã cập nhật voucher ${this.form.code}`);
        this.cdr?.markForCheck();
      },
      error: (httpErr) => {
        this.saving = false;
        const msg = httpErr?.error?.message || 'Không thể cập nhật voucher.';
        this.formError = msg;
        this.notify(msg, 'err');
        this.cdr?.markForCheck();
      },
    });
  }

  private applyLocalSave(payload: {
    code: string;
    description: string | null;
    discountType: DiscountType;
    discountValue: number;
    minOrderValue: number;
    coinsCost: number;
    redeemLimit: number;
    usageLimit: number;
    status: VoucherStatus;
  }): void {
    if (this.isCreating) {
      if (this.vouchers.some((v) => v.code === payload.code)) {
        const msg = `Mã Voucher "${payload.code}" đã tồn tại.`;
        this.formError = msg;
        this.notify(msg, 'err');
        return;
      }
      const created: VoucherItem = {
        id: `v-${Date.now()}`,
        code: payload.code,
        description: payload.description ?? '',
        discountType: payload.discountType,
        discountValue: payload.discountValue,
        minOrderValue: payload.minOrderValue,
        coinsCost: payload.coinsCost,
        redeemLimit: payload.redeemLimit,
        redeemCount: 0,
        usageLimit: payload.usageLimit,
        usageCount: 0,
        validFrom: this.form.validFrom,
        validTo: this.form.validTo,
        status: payload.status,
      };
      this.vouchers = [created, ...this.vouchers];
      this.selectVoucher(created);
      this.notify(`Đã tạo voucher ${created.code} (chế độ ngoại tuyến)`);
      return;
    }

    this.vouchers = this.vouchers.map((v) =>
      v.id === this.selectedId
        ? {
            ...v,
            description: payload.description ?? '',
            discountType: payload.discountType,
            discountValue: payload.discountValue,
            minOrderValue: payload.minOrderValue,
            coinsCost: payload.coinsCost,
            redeemLimit: payload.redeemLimit,
            usageLimit: payload.usageLimit,
            validFrom: this.form.validFrom,
            validTo: this.form.validTo,
            status: payload.status,
          }
        : v,
    );
    const updated = this.vouchers.find((v) => v.id === this.selectedId);
    if (updated) this.selectVoucher(updated);
    this.notify(`Đã cập nhật voucher ${this.form.code}`);
  }

  toggleStatus(item: VoucherItem, event: Event): void {
    event.stopPropagation();
    const nextStatus: VoucherStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    if (!this.http || this.usingFallback) {
      this.vouchers = this.vouchers.map((v) =>
        v.id === item.id ? { ...v, status: nextStatus } : v,
      );
      if (this.selectedId === item.id) {
        this.form.status = nextStatus;
      }
      this.notify(
        `${item.code}: ${nextStatus === 'ACTIVE' ? 'Đã kích hoạt' : 'Đã tạm ngừng áp dụng'}`,
      );
      return;
    }

    this.http.patch<any>(`/api/vouchers/${item.id}`, { status: nextStatus }).subscribe({
      next: () => {
        this.vouchers = this.vouchers.map((v) =>
          v.id === item.id ? { ...v, status: nextStatus } : v,
        );
        if (this.selectedId === item.id) {
          this.form.status = nextStatus;
        }
        this.notify(
          `${item.code}: ${nextStatus === 'ACTIVE' ? 'Đã kích hoạt' : 'Đã tạm ngừng áp dụng'}`,
        );
        this.cdr?.markForCheck();
      },
      error: (err) => {
        this.notify(err?.error?.message || 'Không thể đổi trạng thái voucher.', 'err');
      },
    });
  }

  exportCsv(): void {
    const header = [
      'Code',
      'Description',
      'DiscountType',
      'DiscountValue',
      'MinOrderVND',
      'CoinsCost',
      'RedeemCount',
      'RedeemLimit',
      'UsageCount',
      'UsageLimit',
      'ValidFrom',
      'ValidTo',
      'Status',
    ];
    const rows = this.filteredVouchers.map((v) => [
      v.code,
      v.description,
      v.discountType,
      v.discountValue,
      v.minOrderValue,
      v.coinsCost,
      v.redeemCount,
      v.redeemLimit,
      v.usageCount,
      v.usageLimit,
      v.validFrom,
      v.validTo,
      v.status,
    ]);
    const csv = [header, ...rows]
      .map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    if (typeof document !== 'undefined') {
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ken-vouchers-${this.todayIso()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    this.notify(`Đã xuất ${this.filteredVouchers.length} voucher ra CSV`);
  }

  formatCurrency(value: number): string {
    return `${Math.round(value || 0).toLocaleString('vi-VN')}đ`;
  }

  formatDiscountLabel(v: Pick<VoucherItem, 'discountType' | 'discountValue'>): string {
    return v.discountType === 'PERCENT'
      ? `Giảm ${v.discountValue}%`
      : `Giảm ${this.formatCurrency(v.discountValue)}`;
  }

  formatDateVi(isoDate: string): string {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return isoDate || '—';
    const [y, m, d] = isoDate.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  statusLabel(v: Pick<VoucherItem, 'status' | 'validTo'>): string {
    if (v.status === 'INACTIVE') return 'Tạm ngừng';
    if (this.isExpired(v)) return 'Hết hạn';
    return 'Đang áp dụng';
  }

  private notify(msg: string, type: 'ok' | 'err' = 'ok'): void {
    this.toast = msg;
    this.toastType = type;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast = '';
      this.cdr?.markForCheck();
    }, 3200);
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  }
}
