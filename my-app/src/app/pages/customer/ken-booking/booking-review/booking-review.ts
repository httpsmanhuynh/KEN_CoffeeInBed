import { Component, inject } from '@angular/core';
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

@Component({ selector: 'app-ken-booking-review', standalone: false, templateUrl: './booking-review.html', styleUrl: './booking-review.css' })
export class KenBookingReviewPage {
  private readonly api = tryInjectCustomerApi();
  feedback = '';
  voucherMessage = '';
  checkingSession = false;
  submitting = false;
  readonly money = kenMoney;
  constructor(public state: KenBookingState, private router: Router, private auth: AuthService) {}

  ngOnInit(): void {
    const existing = this.auth.user;
    if (existing) {
      this.prefillUserContact(existing);
      return;
    }
    this.auth.ensureSession().subscribe({
      next: user => {
        if (user) this.prefillUserContact(user);
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

        const findProduct = (localId: string, expectedCategory: 'DRINK' | 'PASTRY') => {
          const target = normName(PRODUCT_NAME_MAP[localId]);
          return products.find(
            (p: any) =>
              normName(p.name) === target &&
              (!p.category || p.category === expectedCategory),
          ) || products.find((p: any) => normName(p.name) === target);
        };

        const mappedInclusions: Array<{ packageInclusionId: string; productId: string; quantity: number }> = [];
        const extraDrinksAsAddons: Array<{ name: string; quantity: number }> = [];

        if (drinkInc?._id) {
          let remainingDrinkQuota =
            Number(drinkInc.quantity || 0) * (drinkInc.quantity_basis === 'PER_GUEST' ? d.guests : 1);
          for (const item of this.state.selectedDrinks) {
            if (remainingDrinkQuota <= 0) break;
            const take = Math.min(item.quantity, remainingDrinkQuota);
            const matchedProd = findProduct(item.product.id, 'DRINK');
            if (matchedProd?._id && take > 0) {
              mappedInclusions.push({
                packageInclusionId: String(drinkInc._id),
                productId: String(matchedProd._id),
                quantity: take,
              });
              remainingDrinkQuota -= take;
            }
          }
        } else {
          for (const item of this.state.selectedDrinks) {
            const targetName = PRODUCT_NAME_MAP[item.product.id] || item.product.name;
            extraDrinksAsAddons.push({ name: targetName, quantity: item.quantity });
          }
        }

        if (pastryInc?._id) {
          const allowedPastryQuota =
            Number(pastryInc.quantity || 0) * (pastryInc.quantity_basis === 'PER_GUEST' ? d.guests : 1);
          let remainingPastry = allowedPastryQuota;
          for (const item of this.state.selectedPastries) {
            if (remainingPastry <= 0) break;
            const take = Math.min(item.quantity, remainingPastry);
            const matchedProd = findProduct(item.product.id, 'PASTRY');
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
              findProduct('croissant', 'PASTRY') ||
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

        const mappedAddons: Array<{ addonId: string; quantity: number }> = [];
        const addMappedAddon = (addonObj: any, qty: number) => {
          if (!addonObj?._id || qty < 1) return;
          const clampedQty = addonObj.unit === 'PER_BOOKING' ? 1 : qty;
          const existing = mappedAddons.find((a) => a.addonId === String(addonObj._id));
          if (existing) {
            existing.quantity = addonObj.unit === 'PER_BOOKING' ? 1 : existing.quantity + clampedQty;
          } else {
            mappedAddons.push({ addonId: String(addonObj._id), quantity: clampedQty });
          }
        };

        for (const extraItem of this.state.selectedExtrasList) {
          const targetName = normName(ADDON_NAME_MAP[extraItem.extra.id] || extraItem.extra.title);
          const matchedAddon = addons.find((a: any) => normName(a.name) === targetName);
          addMappedAddon(matchedAddon, extraItem.quantity);
        }

        for (const extraDrink of extraDrinksAsAddons) {
          const matchedAddon = addons.find((a: any) => normName(a.name) === normName(extraDrink.name));
          addMappedAddon(matchedAddon, extraDrink.quantity);
        }

        return { sp, pkg, startAt, d, mappedInclusions, mappedAddons };
      }),
    );
  }

  checkVoucher(): void {
    const code = this.state.draft().voucher.trim();
    if (!code) { this.voucherMessage = 'Vui lòng nhập mã khuyến mãi.'; return; }
    if (!this.api) { this.voucherMessage = 'Mã khuyến mãi chưa kết nối hệ thống. Bản mô phỏng không áp dụng mã này.'; return; }
    this.voucherMessage = 'Đang kiểm tra mã…';
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
        this.voucherMessage = `Áp dụng mã ${q.voucherCode} thành công: giảm ${this.money(q.pricing.voucherDiscount)} (tổng thanh toán: ${this.money(q.pricing.finalAmount)}).`;
      },
      error: (err) => {
        this.voucherMessage = err?.error?.message || 'Mã voucher không hợp lệ hoặc chưa đủ điều kiện áp dụng.';
      },
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
            voucherCode: d.voucher.trim() || undefined,
          });
        }),
      ).subscribe({
        next: (booking) => {
          this.submitting = false;
          this.state.set({
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
