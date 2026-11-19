import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../../core/auth.service';
import { CustomerApiService } from '../../../../core/customer-api.service';
import { KenBookingState, kenMoney } from '../booking-state';
import type { KenBookingDraft } from '../booking-state';

const SPACE_CODE_MAP: Record<string, string> = {
  focus: 'FP-01',
  work: 'WL-01',
  'meeting-small': 'SMR-01',
  'meeting-large': 'BR-01',
  single: 'SBP-01',
  double: 'DBP-01',
  private: 'PS-01',
};

const PRODUCT_NAME_MAP: Record<string, string> = {
  coffee: 'Cà phê đen',
  americano: 'Americano',
  'bac-xiu': 'Bạc xỉu',
  'cold-brew': 'Cold Brew truyền thống',
  oolong: 'Hồng trà Oolong Macchiato',
  matcha: 'Matcha Latte',
  hojicha: 'Hojicha Latte',
  water: 'Nước tinh khiết',
  juice: 'Nước cam',
  soda: 'Soda trái cây',
  croissant: 'Croissant bơ',
  mousse: 'Mousse trà xanh',
  tiramisu: 'Tiramisu',
  bread: 'Bánh mì que',
};

const ADDON_NAME_MAP: Record<string, string> = {
  'extra-coffee': 'Cà phê đen',
  'extra-americano': 'Americano',
  'extra-matcha': 'Matcha Latte',
  'extra-hojicha': 'Hojicha Latte',
  'extra-water': 'Nước tinh khiết',
  'extra-juice': 'Nước cam',
  'extra-croissant': 'Croissant bơ',
  'extra-mousse': 'Mousse trà xanh',
  'extra-sandwich': 'Sandwich',
  'extra-fruit': 'Trái cây cắt sẵn',
  'extra-monitor': 'Thuê màn hình rời 24 inch',
  'extra-keyboard': 'Bàn phím và chuột rời',
  'extra-phone': 'Cáp và sạc dự phòng',
  'extra-stationery': 'Bộ bút và bảng nhỏ',
  'extra-printer': 'In tài liệu dưới 20 trang A4',
};

function normName(value: string | undefined | null): string {
  return (value || '').trim().toLocaleLowerCase('vi-VN');
}

function tryInjectCustomerApi(): CustomerApiService | null {
  try {
    return inject(CustomerApiService, { optional: true });
  } catch {
    return null;
  }
}

export interface UserVoucherOption {
  code: string;
  desc: string;
  used: boolean;
  discountType: 'PERCENT' | 'FIXED_AMOUNT' | string;
  discountValue: number;
  minOrderValue: number;
  maxDiscount: number | null;
  validFrom?: string;
  validTo?: string;
  usageCount?: number;
  usageLimit?: number;
}

export interface UsableVoucherView extends UserVoucherOption {
  estimatedDiscount: number;
  isBest: boolean;
}

@Component({ selector: 'app-ken-booking-review', standalone: false, templateUrl: './booking-review.html', styleUrl: './booking-review.css' })
export class KenBookingReviewPage {
  private readonly api = tryInjectCustomerApi();
  feedback = '';
  voucherMessage = '';
  voucherSuccess = false;
  private readonly cdr = (() => { try { return inject(ChangeDetectorRef); } catch { return { markForCheck: () => {} } as ChangeDetectorRef; } })();
  appliedVoucherCode = '';
  appliedVoucherDiscount = 0;
  userVoucherList: UserVoucherOption[] = [];
  voucherDropdownOpen = false;
  checkingSession = false;
  submitting = false;
  readonly money = kenMoney;
  constructor(public state: KenBookingState, private router: Router, private auth: AuthService) {}

  get memberDiscount(): number {
    return this.state.silverDiscount;
  }
  get tierDiscountLabel(): string {
    return this.state.tierDiscountLabel || 'Ưu đãi thành viên';
  }

  get finalTotal(): number {
    return Math.max(0, this.state.subtotal - this.memberDiscount - this.appliedVoucherDiscount);
  }

  ngOnInit(): void {
    const existing = this.auth.user;
    if (existing) {
      this.prefillUserContact(existing);
      this.autoApplyVoucher();
      return;
    }
    this.auth.ensureSession().subscribe({
      next: user => {
        if (user) { this.prefillUserContact(user); this.autoApplyVoucher(); }
      },
      error: () => {},
    });
  }

  private prefillUserContact(user: { fullName?: string; phone?: string; email?: string | null }): void {
    const draft = this.state.draft();
    const patch: { fullName?: string; phone?: string; email?: string } = {};
    if (!draft.fullName?.trim() && user.fullName) patch.fullName = user.fullName;
    if (!draft.phone?.trim() && user.phone) patch.phone = user.phone;
    if (!draft.email?.trim() && user.email) patch.email = user.email;
    if (Object.keys(patch).length > 0) {
      this.state.set(patch);
    }
  }

  get canConfirm(): boolean {
    const d = this.state.draft();
    const hasName = !!d.fullName && d.fullName.trim().length >= 2;
    const rawPhone = (d.phone || '').trim().replace(/\s+/g, '');
    const hasPhone = /^(?:\+84|84|0)\d{9,10}$/.test(rawPhone);
    const hasEmail = !!d.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim());
    const hasAgreed = !!d.agreed;
    return hasName && hasPhone && hasEmail && hasAgreed && !this.checkingSession && !this.submitting;
  }

  setContact(key: 'fullName' | 'phone' | 'email' | 'note' | 'voucher', value: string): void {
    this.state.set({ [key]: value } as Pick<KenBookingDraft, typeof key>);
    this.feedback = '';
    if (key === 'voucher' && value.trim().toUpperCase() !== this.appliedVoucherCode.toUpperCase()) {
      const hadApplied = !!(this.appliedVoucherCode || this.appliedVoucherDiscount > 0);
      this.appliedVoucherCode = '';
      this.appliedVoucherDiscount = 0;
      this.voucherSuccess = false;
      this.voucherMessage = '';
      if (hadApplied) {
        this.state.clearAppliedVoucher();
      }
    }
  }
  setAgreed(value: boolean): void { this.state.set({ agreed: value }); this.feedback = ''; }
  extraCount(id: string): number { return this.state.draft().extras[id] || 0; }
  drinkCharge(price: number, quantity: number): number {
    return Math.max(0, price - this.state.entitlement) * quantity;
  }

  private resolveRealTarget() {
    const d = this.state.draft();
    const startAt = new Date(`${d.date}T${String(d.startHour).padStart(2, '0')}:00:00+07:00`).toISOString();
    const products$ = typeof this.api!.getProducts === 'function'
      ? this.api!.getProducts().pipe(catchError(() => of([])))
      : of([]);
    const addons$ = typeof this.api!.getAddons === 'function'
      ? this.api!.getAddons().pipe(catchError(() => of([])))
      : of([]);

    return forkJoin({
      spaces: this.api!.getSpaces({ startAt, hours: String(d.hours), guestCount: String(d.guests) }),
      products: products$,
      addons: addons$,
    }).pipe(
      map(({ spaces, products, addons }) => {
        const expectedCode = SPACE_CODE_MAP[d.spaceId];
        const sp = spaces.find((s) => s.space_code === expectedCode) || spaces[0];
        const pkgs: any[] = sp?.packages || [];
        const pkg =
          (d.hours === 14
            ? pkgs.find((p) => p.is_full_day || p.package_type === 'FULL_DAY')
            : undefined) ||
          pkgs.find(
            (p) =>
              (!p.package_type || p.package_type === 'FIXED') &&
              p.duration_hours === d.hours,
          ) ||
          pkgs.find((p) => p.package_type === 'HOURLY') ||
          pkgs[0];

        const pkgInclusions: any[] = pkg?.inclusions || [];
        const drinkInc = pkgInclusions.find((inc) => inc.item_type === 'STANDARD_DRINK');
        const pastryInc = pkgInclusions.find((inc) => inc.item_type === 'PASTRY');

        const findProduct = (itemProduct: { id: string; apiProductId?: string; itemCode?: string; name?: string }, expectedCategory: 'DRINK' | 'PASTRY') => {
          if (itemProduct.apiProductId) {
            const byId = products.find((p: any) => String(p._id) === itemProduct.apiProductId);
            if (byId) return byId;
          }
          if (itemProduct.itemCode) {
            const byCode = products.find((p: any) => String(p.item_code || '').toUpperCase() === itemProduct.itemCode!.toUpperCase());
            if (byCode) return byCode;
          }
          const byLocalIdOrName = products.find(
            (p: any) =>
              String(p._id) === itemProduct.id ||
              normName(p.item_code) === normName(itemProduct.id) ||
              (itemProduct.name && normName(p.name) === normName(itemProduct.name) && (!p.category || p.category === expectedCategory)),
          );
          if (byLocalIdOrName) return byLocalIdOrName;
          const target = normName(PRODUCT_NAME_MAP[itemProduct.id] || itemProduct.name);
          return products.find(
            (p: any) =>
              normName(p.name) === target &&
              (!p.category || p.category === expectedCategory),
          ) || products.find((p: any) => normName(p.name) === target);
        };

        const mappedInclusions: Array<{ packageInclusionId: string; productId: string; quantity: number; variant?: string }> = [];
        const extraDrinksAsAddons: Array<{ name: string; quantity: number; variant?: string }> = [];

        if (drinkInc?._id) {
          let remainingDrinkQuota =
            Number(drinkInc.quantity || 0) * (drinkInc.quantity_basis === 'PER_GUEST' ? d.guests : 1);
          for (const item of this.state.selectedDrinks) {
            if (remainingDrinkQuota <= 0) break;
            const take = Math.min(item.quantity, remainingDrinkQuota);
            const matchedProd = findProduct(item.product, 'DRINK');
            if (matchedProd?._id && take > 0) {
              mappedInclusions.push({
                packageInclusionId: String(drinkInc._id),
                productId: String(matchedProd._id),
                quantity: take,
                ...(item.variant ? { variant: item.variant } : {}),
              });
              remainingDrinkQuota -= take;
            }
          }
        } else {
          for (const item of this.state.selectedDrinks) {
            const targetName = PRODUCT_NAME_MAP[item.product.id] || item.product.name;
            extraDrinksAsAddons.push({ name: targetName, quantity: item.quantity, variant: item.variant });
          }
        }

        if (pastryInc?._id) {
          const allowedPastryQuota =
            Number(pastryInc.quantity || 0) * (pastryInc.quantity_basis === 'PER_GUEST' ? d.guests : 1);
          let remainingPastry = allowedPastryQuota;
          for (const item of this.state.selectedPastries) {
            if (remainingPastry <= 0) break;
            const take = Math.min(item.quantity, remainingPastry);
            const matchedProd = findProduct(item.product, 'PASTRY');
            if (matchedProd?._id && take > 0) {
              mappedInclusions.push({
                packageInclusionId: String(pastryInc._id),
                productId: String(matchedProd._id),
                quantity: take,
              });
              remainingPastry -= take;
            }
          }
          if (remainingPastry > 0) {
            const defaultPastry =
              findProduct({ id: 'croissant' }, 'PASTRY') ||
              products.find((p: any) => p.category === 'PASTRY');
            if (defaultPastry?._id) {
              const existingIdx = mappedInclusions.findIndex(
                (i) => i.packageInclusionId === String(pastryInc._id) && i.productId === String(defaultPastry._id),
              );
              if (existingIdx >= 0) {
                mappedInclusions[existingIdx].quantity += remainingPastry;
              } else {
                mappedInclusions.push({
                  packageInclusionId: String(pastryInc._id),
                  productId: String(defaultPastry._id),
                  quantity: remainingPastry,
                });
              }
            }
          }
        }

        const mappedAddons: Array<{ addonId: string; quantity: number; variant?: string }> = [];
        const addMappedAddon = (addonObj: any, qty: number, variant?: string) => {
          if (!addonObj?._id || qty < 1) return;
          const clampedQty = addonObj.unit === 'PER_BOOKING' ? 1 : qty;
          const existing = mappedAddons.find((a) => a.addonId === String(addonObj._id) && a.variant === variant);
          if (existing) {
            existing.quantity = addonObj.unit === 'PER_BOOKING' ? 1 : existing.quantity + clampedQty;
          } else {
            mappedAddons.push({
              addonId: String(addonObj._id),
              quantity: clampedQty,
              ...(variant ? { variant } : {}),
            });
          }
        };

        for (const extraItem of this.state.selectedExtrasList) {
          const targetName = normName(ADDON_NAME_MAP[extraItem.extra.id] || extraItem.extra.title);
          const matchedAddon =
            (extraItem.extra.apiAddonId
              ? addons.find((a: any) => String(a._id) === extraItem.extra.apiAddonId)
              : undefined) ||
            addons.find(
              (a: any) =>
                String(a._id) === extraItem.extra.id ||
                normName(a.name) === normName(extraItem.extra.title) ||
                normName(a.name) === targetName,
            );
          addMappedAddon(matchedAddon, extraItem.quantity, extraItem.variant);
        }

        for (const extraDrink of extraDrinksAsAddons) {
          const matchedAddon = addons.find((a: any) => normName(a.name) === normName(extraDrink.name));
          addMappedAddon(matchedAddon, extraDrink.quantity, extraDrink.variant);
        }

        return { sp, pkg, startAt, d, mappedInclusions, mappedAddons };
      }),
    );
  }

  toggleVoucherDropdown(): void {
    this.voucherDropdownOpen = !this.voucherDropdownOpen;
  }

  get usableVoucherList(): UsableVoucherView[] {
    const subtotal = this.state.subtotal;
    const nowMs = Date.now();
    const eligible = this.userVoucherList
      .filter((item) => this.isVoucherUsable(item, subtotal, nowMs))
      .map((item) => ({
        ...item,
        estimatedDiscount: this.computeEstimatedDiscount(item, subtotal),
        isBest: false,
      }));

    eligible.sort((a, b) => {
      if (b.estimatedDiscount !== a.estimatedDiscount) {
        return b.estimatedDiscount - a.estimatedDiscount;
      }
      const aRaw = a.discountType === 'PERCENT' ? Math.floor((subtotal * a.discountValue) / 100) : a.discountValue;
      const bRaw = b.discountType === 'PERCENT' ? Math.floor((subtotal * b.discountValue) / 100) : b.discountValue;
      if (aRaw !== bRaw) return aRaw - bRaw;
      return a.code.localeCompare(b.code);
    });

    if (eligible.length > 0 && eligible[0].estimatedDiscount > 0) {
      eligible[0].isBest = true;
    }
    return eligible;
  }

  private computeEstimatedDiscount(item: UserVoucherOption, subtotal: number): number {
    if (subtotal <= 0) return 0;
    const raw =
      item.discountType === 'PERCENT'
        ? Math.floor((subtotal * item.discountValue) / 100)
        : item.discountValue;
    const cappedByMax = item.maxDiscount && item.maxDiscount > 0 ? Math.min(raw, item.maxDiscount) : raw;
    return Math.min(subtotal, Math.max(0, cappedByMax));
  }

  private isVoucherUsable(item: UserVoucherOption, subtotal: number, nowMs: number): boolean {
    if (item.used) return false;
    if (subtotal < item.minOrderValue) return false;
    if (item.validFrom) {
      const fromMs = new Date(item.validFrom).getTime();
      if (Number.isFinite(fromMs) && nowMs < fromMs) return false;
    }
    if (item.validTo) {
      const toMs = new Date(item.validTo).getTime();
      if (Number.isFinite(toMs) && nowMs > toMs) return false;
    }
    if (
      item.usageLimit !== undefined &&
      item.usageCount !== undefined &&
      item.usageCount >= item.usageLimit
    ) {
      return false;
    }
    return true;
  }

  selectVoucherItem(item: { code: string; used: boolean }): void {
    if (item.used) return;
    this.state.set({ voucher: item.code });
    this.voucherDropdownOpen = false;
    this.checkVoucher(false);
  }

  checkVoucher(silent = false): void {
    const code = this.state.draft().voucher.trim();
    if (!code) { this.voucherMessage = 'Vui lòng nhập mã khuyến mãi.'; this.voucherSuccess = false; return; }
    if (!this.api) { this.voucherMessage = 'Mã khuyến mãi chưa kết nối hệ thống.'; this.voucherSuccess = false; return; }
    this.voucherSuccess = false;
    if (!silent) this.voucherMessage = 'Đang kiểm tra mã…';
    this.resolveRealTarget().pipe(
      switchMap(({ sp, pkg, startAt, d, mappedInclusions, mappedAddons }) => {
        if (!sp?._id || !pkg?._id) throw { error: { message: 'Không tìm thấy gói phù hợp trong hệ thống.' } };
        return this.api!.quoteBooking({
          spaceId: String(sp._id),
          packageId: String(pkg._id),
          startAt,
          hours: d.hours,
          guestCount: d.guests,
          inclusions: mappedInclusions,
          addons: mappedAddons,
          voucherCode: code,
        });
      }),
    ).subscribe({
      next: (q) => {
        this.appliedVoucherCode = q.voucherCode || code;
        this.appliedVoucherDiscount = q.pricing?.voucherDiscount || 0;
        this.state.applyQuoteWithVoucher(this.appliedVoucherCode, q);
        this.voucherSuccess = true;
        this.voucherMessage = 'Áp dụng thành công';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.appliedVoucherCode = '';
        this.appliedVoucherDiscount = 0;
        this.state.clearAppliedVoucher();
        this.voucherSuccess = false;
        const errCode = err?.error?.code;
        const errMsg = err?.error?.message || 'Mã voucher không hợp lệ hoặc chưa đủ điều kiện áp dụng.';
        const isUsedError = errCode === 'VOUCHER_ALREADY_USED';
        this.voucherMessage = (!silent || isUsedError) ? errMsg : '';
        if (silent) this.state.set({ voucher: '' });
        this.cdr.markForCheck();
      },
    });
  }

  private formatVoucherDesc(v: any): string {
    const discountPart =
      v.discount_type === 'PERCENT'
        ? `Giảm ${Number(v.discount_value || 0)}%`
        : `Giảm ${this.money(Number(v.discount_value || 0))}`;
    const minVal = Number(v.min_order_value || 0);
    return minVal > 0 ? `${discountPart} · Đơn từ ${this.money(minVal)}` : discountPart;
  }

  /** Tải ví voucher (kèm trạng thái đã dùng/chưa dùng) và tự động áp dụng mã chưa dùng nếu phù hợp. */
  private autoApplyVoucher(): void {
    if (!this.api) return;
    forkJoin({
      wallet: this.api.getMyVouchers().pipe(catchError(() => of(null as any))),
      vouchers: this.api.getVouchers().pipe(catchError(() => of([] as any[]))),
    }).subscribe(({ wallet, vouchers }) => {
      const list: any[] = Array.isArray(wallet) ? wallet : (wallet?.vouchers ?? []);
      const allVouchers: any[] = Array.isArray(vouchers) ? vouchers : [];

      const built: UserVoucherOption[] = [];
      for (const v of allVouchers) {
        if (!v?.code || (v.status && v.status !== 'ACTIVE')) continue;
        const baseMeta = {
          code: String(v.code),
          desc: this.formatVoucherDesc(v),
          discountType: v.discount_type || 'FIXED_AMOUNT',
          discountValue: Number(v.discount_value || 0),
          minOrderValue: Number(v.min_order_value || 0),
          maxDiscount: v.max_discount != null ? Number(v.max_discount) : null,
          validFrom: v.valid_from,
          validTo: v.valid_to,
          usageCount: v.usage_count != null ? Number(v.usage_count) : undefined,
          usageLimit: v.usage_limit != null ? Number(v.usage_limit) : undefined,
        };
        const isCoin = Number(v.coins_cost || 0) > 0;
        if (!isCoin) {
          built.push({
            ...baseMeta,
            used: Boolean(v.used_by_user),
          });
        } else {
          const owned = list.filter((w) => String(w.voucher_id) === String(v._id));
          if (owned.length > 0 || Number(v.owned_unused_count || 0) > 0 || v.used_by_user) {
            const hasUnused =
              owned.length > 0
                ? owned.some((w) => !w.used_booking_id)
                : Number(v.owned_unused_count || 0) > 0;
            built.push({
              ...baseMeta,
              used: !hasUnused,
            });
          }
        }
      }
      built.sort((a, b) => Number(a.used) - Number(b.used));
      this.userVoucherList = built;

      const draftCode = this.state.draft().voucher?.trim();
      if (draftCode) {
        const matched = built.find((item) => item.code.toUpperCase() === draftCode.toUpperCase());
        if (matched?.used) {
          this.appliedVoucherCode = '';
          this.appliedVoucherDiscount = 0;
          this.voucherSuccess = false;
          this.voucherMessage = 'Mã ưu đãi này đã được bạn sử dụng.';
          this.state.set({ voucher: '' });
          this.state.clearAppliedVoucher();
          this.cdr.markForCheck();
          return;
        }
        this.cdr.markForCheck();
        this.checkVoucher(true);
        return;
      }

      const now = Date.now();
      for (const item of list) {
        if (item.used_booking_id) continue;
        const redeemedAt = new Date(item.redeemed_at).getTime();
        if (Number.isFinite(redeemedAt) && now - redeemedAt > 30 * 24 * 3600 * 1000) continue;
        const v = allVouchers.find((x) => String(x._id) === String(item.voucher_id));
        if (v?.code) {
          this.state.set({ voucher: v.code });
          this.cdr.markForCheck();
          this.checkVoucher(true);
          return;
        }
      }
      this.cdr.markForCheck();
    });
  }
  confirm(): void {
    if (this.checkingSession || this.submitting) return;
    this.checkingSession = true;
    this.auth.ensureSession().subscribe({
      next: user => {
        this.checkingSession = false;
        if (!user) {
          this.router.navigate(['/login'], { queryParams: { returnUrl: '/booking/review' } });
          return;
        }
        this.prefillUserContact(user);
        const draft = this.state.draft();
        if (!draft.fullName?.trim() || !draft.phone?.trim() || !draft.email?.trim() || !draft.agreed) {
          this.feedback = 'Vui lòng điền đầy đủ Họ và tên, Số điện thoại, Email và đồng ý với điều khoản trước khi xác nhận.';
          return;
        }
        this.confirmAuthenticated();
      },
      error: () => {
        this.checkingSession = false;
        this.router.navigate(['/login'], { queryParams: { returnUrl: '/booking/review' } });
      },
    });
  }

  private confirmAuthenticated(): void {
    const d = this.state.draft();
    // Đơn đã tạo: không tạo Booking mới, không đặt lại hạn (BR-E03). Kiểm tra TRƯỚC khi xét lại lead-time.
    if (this.api && d.createdBookingId) {
      if (d.paymentStatus === 'CONFIRMED') {
        this.router.navigateByUrl('/bookings/payment');
        return;
      }
      if (d.paymentStatus === 'PENDING_PAYMENT' && d.holdUntil && d.holdUntil > Date.now()) {
        this.router.navigateByUrl('/bookings/payment');
        return;
      }
    }
    if (!this.state.isSlotValid) {
      this.feedback = 'Khung giờ đã chọn chưa hợp lệ hoặc không còn cách hiện tại ít nhất 30 phút. Hãy quay lại chọn ngày giờ.';
    } else if (this.state.requiredDrinkCount > 0 &&
               this.state.selectedDrinkCount !== this.state.requiredDrinkCount) {
      this.feedback = `Vui lòng chọn đủ ${this.state.requiredDrinkCount} đồ uống trước khi xác nhận.`;
    } else if (!d.fullName.trim() || !/^((0|\+84)[0-9]{9,10})$/.test(d.phone.trim()) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) {
      this.feedback = 'Vui lòng nhập họ tên, số điện thoại và email hợp lệ.';
    } else if (!d.agreed) {
      this.feedback = 'Bạn cần đọc và đồng ý với Điều khoản & Chính sách trước khi tiếp tục.';
    } else {
      this.feedback = '';
      if (!this.api) {
        this.state.startDemoHold();
        this.router.navigateByUrl('/bookings/payment');
        return;
      }
      // Nếu đã có đơn PENDING_PAYMENT còn hạn cho đúng lựa chọn hiện tại (vừa quay lại để bổ sung thông tin liên hệ) -> đi thẳng sang thanh toán.
      if (d.createdBookingId && d.holdUntil && d.holdUntil > Date.now() && d.paymentStatus === 'PENDING_PAYMENT') {
        this.router.navigateByUrl('/bookings/payment');
        return;
      }
      if (this.submitting) return;
      this.submitting = true;
      this.resolveRealTarget().pipe(
        switchMap(({ sp, pkg, startAt, mappedInclusions, mappedAddons }) => {
          if (!sp?._id || !pkg?._id) throw { error: { message: 'Không tìm thấy không gian hoặc gói phù hợp trên server.' } };
          return this.api!.createBooking({
            spaceId: String(sp._id),
            packageId: String(pkg._id),
            startAt,
            hours: d.hours,
            guestCount: d.guests,
            inclusions: mappedInclusions,
            addons: mappedAddons,
            voucherCode: this.appliedVoucherCode || undefined,
          });
        }),
      ).subscribe({
        next: (booking) => {
          this.submitting = false;
          this.state.syncQuoteFromBooking(booking);
          this.state.set({
            voucher: '',
            holdUntil: booking.payment_expires_at ? new Date(booking.payment_expires_at).getTime() : Date.now() + 15 * 60000,
            createdBookingId: booking._id,
            createdBookingCode: booking.booking_code,
            paymentStatus: booking.status,
          });
          this.router.navigateByUrl('/bookings/payment');
        },
        error: (err) => {
          this.submitting = false;
          this.feedback = err?.error?.message || 'Không thể tạo đơn đặt chỗ. Vui lòng kiểm tra lại khung giờ.';
        },
      });
    }
  }

  get selectedExtras() {
    return this.state.extras.filter(extra => this.extraCount(extra.id) > 0);
  }
}
