import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/auth.service';
import { ApiLoyaltyHistory, CustomerApiService } from '../../../../core/customer-api.service';
import { KenBookingState } from '../../ken-booking/booking-state';

type HistoryTab = 'all' | 'pending' | 'earned' | 'spent';
type HistoryKind = 'pending' | 'earned' | 'spent';

interface VoucherItem {
  id?: string;
  code?: string;
  type: string;
  name: string;
  desc: string;
  cost: number;
  discountText?: string;
  conditionText?: string;
  validityText?: string;
}

interface GiftItem {
  image: string;
  name: string;
  desc: string;
  cost: number;
  codePrefix: string;
}

type HistoryVoucher = NonNullable<ApiLoyaltyHistory['transactions'][number]['voucher']>;

interface HistoryEntry {
  id: string;
  date: string;
  createdAtFormatted: string;
  detail: string;
  rawNote: string;
  amount: string;
  coinsDelta: number;
  coinsAfter: number;
  state: string;
  kind: HistoryKind;
  plus: boolean;
  type: 'EARN' | 'REDEEM' | 'YEAR_RESET';
  voucherId?: string;
  voucherData?: HistoryVoucher | null;
}

export interface RewardModalData {
  mode: 'voucher' | 'gift' | 'earn';
  title: string;
  subtitle: string;
  code?: string;
  discountText?: string;
  conditionText?: string;
  validityText?: string;
  image?: string;
  dateText?: string;
  coinsText?: string;
  balanceAfterText?: string;
  instructions: string[];
}

@Component({
  selector: 'app-coins-rewards',
  standalone: false,
  templateUrl: './coins-rewards.html',
  styleUrl: './coins-rewards.css',
})
export class CoinsRewardsPage implements OnInit {
  private readonly auth = inject(AuthService, { optional: true });
  private readonly api = inject(CustomerApiService, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly bookingState = inject(KenBookingState, { optional: true });

  private readonly cdr = inject(ChangeDetectorRef);

  balance = 0;
  activeTab: HistoryTab = 'all';
  rewardModal: RewardModalData | null = null;
  copiedCode = false;

  vouchers: VoucherItem[] = [
    {
      type: 'Đồ uống',
      code: 'DRINK30K',
      name: 'Voucher đồ uống 30.000đ',
      desc: 'Cho một ly yêu thích tại KÉN Kết Nối.',
      cost: 200,
      discountText: 'Giảm 30.000đ đồ uống',
      conditionText: 'Áp dụng tại quầy KÉN Kết Nối',
      validityText: '30 ngày sau khi đổi',
    },
    {
      type: 'Không gian',
      code: 'SPACE70K',
      name: 'Voucher không gian 70.000đ',
      desc: 'Dành cho dịch vụ đặt không gian tại KÉN.',
      cost: 450,
      discountText: 'Giảm 70.000đ đặt chỗ',
      conditionText: 'Áp dụng cho mọi không gian KÉN',
      validityText: '30 ngày sau khi đổi',
    },
    {
      type: 'Không gian',
      code: 'SPACE120K',
      name: 'Voucher không gian 120.000đ',
      desc: 'Thêm một khoảng yên cho lịch hẹn mới.',
      cost: 800,
      discountText: 'Giảm 120.000đ đặt chỗ',
      conditionText: 'Áp dụng cho đơn đặt chỗ mới',
      validityText: '30 ngày sau khi đổi',
    },
  ];

  readonly gifts: GiftItem[] = [
    {
      image: '/images/figma/gift-so-tay.png',
      name: 'Sổ tay KÉN · Khoảng riêng',
      desc: 'Bìa kraft, giấy kem · Khổ A5.',
      cost: 350,
      codePrefix: 'SO-TAY',
    },
    {
      image: '/images/figma/gift-tui-tote.png',
      name: 'Túi tote KÉN · Đi thật chậm',
      desc: 'Vải canvas tự nhiên · Một ngăn rộng.',
      cost: 600,
      codePrefix: 'TUI-TOTE',
    },
    {
      image: '/images/figma/gift-coc-gom.png',
      name: 'Cốc gốm KÉN · Một nhịp yên',
      desc: 'Gốm men kem · Dung tích 300 ml.',
      cost: 900,
      codePrefix: 'COC-GOM',
    },
  ];

  readonly tabs: { key: HistoryTab; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'pending', label: 'Đang xử lý' },
    { key: 'earned', label: 'Nhận Coins' },
    { key: 'spent', label: 'Dùng Coins' },
  ];

  history: HistoryEntry[] = [];

  get filteredHistory(): HistoryEntry[] {
    switch (this.activeTab) {
      case 'pending': return this.history.filter(h => h.kind === 'pending');
      case 'earned': return this.history.filter(h => h.plus);
      case 'spent': return this.history.filter(h => !h.plus);
      default: return this.history;
    }
  }

  enough(cost: number): boolean { return this.balance >= cost; }
  missing(cost: number): number { return Math.max(0, cost - this.balance); }
  setTab(t: HistoryTab): void { this.activeTab = t; }
  logout(): void {
    if (!this.auth) return;
    this.auth.logout().subscribe({ next: () => this.router?.navigateByUrl('/') });
  }

  private formatVoucherDiscount(type: 'PERCENT' | 'FIXED_AMOUNT', value: number, max?: number | null): string {
    if (type === 'PERCENT') {
      return `Giảm ${value}%${max ? ' (tối đa ' + Number(max).toLocaleString('vi-VN') + 'đ)' : ''}`;
    }
    return `Giảm ${Number(value).toLocaleString('vi-VN')}đ`;
  }

  private formatVoucherCondition(minOrder?: number | null): string {
    if (minOrder && Number(minOrder) > 0) {
      return `Áp dụng cho đơn từ ${Number(minOrder).toLocaleString('vi-VN')}đ`;
    }
    return 'Áp dụng cho mọi đơn đặt chỗ tại KÉN';
  }

  private mapHistory(history?: ApiLoyaltyHistory | null): HistoryEntry[] {
    if (!history?.transactions?.length) return [];
    return history.transactions.map((tx) => {
      const d = new Date(tx.created_at);
      const plus = tx.coins_delta >= 0;
      const rawNote = tx.note || tx.type;
      return {
        id: String(tx._id),
        kind: (plus ? 'earned' : 'spent') as HistoryKind,
        date: d.toLocaleDateString('vi-VN'),
        createdAtFormatted: d.toLocaleString('vi-VN'),
        detail: rawNote,
        rawNote,
        amount: `${plus ? '+' : ''}${tx.coins_delta} Coins`,
        coinsDelta: tx.coins_delta,
        coinsAfter: tx.coins_after,
        state: `Số dư: ${tx.coins_after.toLocaleString('vi-VN')} Coins`,
        plus,
        type: tx.type,
        voucherId: tx.voucher_id ? String(tx.voucher_id) : undefined,
        voucherData: tx.voucher || null,
      };
    });
  }

  loadHistory(): void {
    if (!this.api) return;
    this.api.getLoyaltyHistory().subscribe({
      next: (history) => {
        this.history = this.mapHistory(history);
        this.cdr.markForCheck();
      },
    });
  }

  ngOnInit(): void {
    if (!this.api || !this.auth) return;
    const session$ = typeof this.auth.loadSession === 'function'
      ? this.auth.loadSession(true)
      : this.auth.ensureSession();

    session$.subscribe({
      next: (user) => {
        if (!user) {
          this.router?.navigate(['/login'], { queryParams: { returnUrl: this.router?.url } });
          return;
        }
        this.balance = Number(user.coinsBalance) || 0;
        this.cdr.markForCheck();
        forkJoin({
          vouchers: this.api!.getVouchers(),
          history: this.api!.getLoyaltyHistory(),
        }).subscribe({
          next: ({ vouchers, history }) => {
            const coinVouchers = vouchers.filter((v) => (v.coins_cost || 0) > 0 && v.status === 'ACTIVE');
            if (coinVouchers.length) {
              this.vouchers = coinVouchers.map((v) => {
                const discountText = this.formatVoucherDiscount(v.discount_type, v.discount_value, v.max_discount);
                const conditionText = this.formatVoucherCondition(v.min_order_value);
                return {
                  id: v._id,
                  code: v.code,
                  type: 'Không gian',
                  name: v.description || `Voucher ${v.code}`,
                  desc: `Mã ${v.code} · ${discountText}`,
                  cost: Number(v.coins_cost),
                  discountText,
                  conditionText,
                  validityText: '30 ngày sau khi đổi',
                };
              });
            }
            this.history = this.mapHistory(history);
            this.cdr.markForCheck();
          },
          error: () => {},
        });
      },
      error: () => {},
    });
  }

  redeem(name: string, cost: number): void {
    if (!this.api || !this.auth?.user) return;
    if (!this.enough(cost)) {
      alert('Bạn chưa đủ số dư Coins để đổi phần quà này.');
      return;
    }

    const voucher = this.vouchers.find((v) => v.name === name);
    const gift = this.gifts.find((g) => g.name === name);
    const payload = voucher?.id
      ? { voucherId: voucher.id, cost: voucher.cost, description: voucher.name }
      : { cost, description: `Đổi quà: ${name}` };

    this.api.redeemCoins(payload).subscribe({
      next: (res) => {
        this.balance = res.coins ?? Math.max(0, this.balance - cost);
        if (this.auth?.user) {
          this.auth.setUser({ ...this.auth.user, coinsBalance: this.balance });
        }
        this.loadHistory();
        this.copiedCode = false;
        setTimeout(() => this.cdr.markForCheck());

        const nowFormatted = new Date().toLocaleString('vi-VN');
        if (voucher) {
          const vInfo = res.voucher;
          const code = vInfo?.code || res.voucherCode || voucher.code || '';
          const discountText = vInfo
            ? this.formatVoucherDiscount(vInfo.discountType, vInfo.discountValue, vInfo.maxDiscount)
            : voucher.discountText;
          const conditionText = vInfo
            ? this.formatVoucherCondition(vInfo.minOrderValue)
            : voucher.conditionText;

          this.rewardModal = {
            mode: 'voucher',
            title: vInfo?.description || voucher.name,
            subtitle: 'Đổi voucher thành công',
            code,
            discountText,
            conditionText,
            validityText: voucher.validityText || '30 ngày sau khi đổi',
            dateText: nowFormatted,
            coinsText: `-${cost} Coins`,
            balanceAfterText: `${this.balance.toLocaleString('vi-VN')} Coins`,
            instructions: [
              'Sao chép mã voucher bên trên để dùng khi đặt không gian.',
              'Nhập mã tại bước Xác nhận đặt chỗ (Booking Review) để hệ thống tự động trừ ưu đãi.',
              'Bạn có thể xem lại mã bất kỳ lúc nào bằng cách nhấp vào giao dịch trong Lịch sử Coins.',
            ],
          };
        } else {
          const prefix = gift?.codePrefix || 'QUA-KEN';
          const pickupCode = `KEN-${prefix}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
          this.rewardModal = {
            mode: 'gift',
            title: gift?.name || name,
            subtitle: 'Đổi quà lưu niệm thành công',
            code: pickupCode,
            image: gift?.image,
            conditionText: gift?.desc || 'Quà lưu niệm chính hãng KÉN',
            validityText: 'Nhận trực tiếp tại quầy lễ tân KÉN',
            dateText: nowFormatted,
            coinsText: `-${cost} Coins`,
            balanceAfterText: `${this.balance.toLocaleString('vi-VN')} Coins`,
            instructions: [
              'Xuất trình mã nhận quà bên trên (hoặc giao dịch trong Lịch sử Coins) tại quầy lễ tân KÉN.',
              'Nhân viên KÉN sẽ kiểm tra giao dịch và trao phần quà trực tiếp cho bạn tại chi nhánh.',
            ],
          };
        }
      },
      error: (err) => {
        alert(err.error?.message || 'Không thể đổi quà lúc này. Vui lòng thử lại sau.');
      },
    });
  }

  openHistoryDetail(h: HistoryEntry): void {
    this.copiedCode = false;
    const spentCoins = Math.abs(h.coinsDelta);
    const coinsText = `${h.coinsDelta > 0 ? '+' : ''}${h.coinsDelta} Coins`;
    const balanceAfterText = `${h.coinsAfter.toLocaleString('vi-VN')} Coins`;

    if (h.plus) {
      this.rewardModal = {
        mode: 'earn',
        title: h.detail,
        subtitle: 'Chi tiết giao dịch nhận Coins',
        dateText: h.createdAtFormatted,
        coinsText,
        balanceAfterText,
        instructions: [
          'Coins được cộng tự động sau khi hoàn tất dịch vụ đặt chỗ tại KÉN.',
        ],
      };
      return;
    }

    // 1. Ưu tiên khớp voucher trả về từ backend
    if (h.voucherData?.code) {
      const v = h.voucherData;
      this.rewardModal = {
        mode: 'voucher',
        title: v.description || h.detail || `Voucher ${v.code}`,
        subtitle: 'Thông tin voucher đã đổi',
        code: v.code,
        discountText: this.formatVoucherDiscount(v.discount_type, v.discount_value, v.max_discount),
        conditionText: this.formatVoucherCondition(v.min_order_value),
        validityText: '30 ngày kể từ ngày đổi',
        dateText: h.createdAtFormatted,
        coinsText,
        balanceAfterText,
        instructions: [
          'Sao chép mã voucher bên trên để áp dụng khi đặt không gian tại KÉN.',
          'Nhập mã tại bước Xác nhận đặt chỗ (Booking Review) để được trừ trực tiếp vào hóa đơn.',
        ],
      };
      return;
    }

    // 2. Khớp voucher đang có qua voucherId
    const matchedVoucherById = h.voucherId
      ? this.vouchers.find((v) => v.id === h.voucherId)
      : undefined;
    if (matchedVoucherById) {
      this.rewardModal = {
        mode: 'voucher',
        title: matchedVoucherById.name,
        subtitle: 'Thông tin voucher đã đổi',
        code: matchedVoucherById.code,
        discountText: matchedVoucherById.discountText,
        conditionText: matchedVoucherById.conditionText,
        validityText: matchedVoucherById.validityText || '30 ngày kể từ ngày đổi',
        dateText: h.createdAtFormatted,
        coinsText,
        balanceAfterText,
        instructions: [
          'Sao chép mã voucher bên trên để áp dụng khi đặt không gian tại KÉN.',
          'Nhập mã tại bước Xác nhận đặt chỗ (Booking Review) để được trừ trực tiếp vào hóa đơn.',
        ],
      };
      return;
    }

    // 3. Khớp quà lưu niệm qua tên hoặc nhãn "Đổi quà:" hoặc số Coins (350/600/900)
    const lowerNote = h.rawNote.toLowerCase();
    const matchedGift =
      this.gifts.find((g) => lowerNote.includes(g.name.toLowerCase())) ||
      (lowerNote.includes('đổi quà') ? this.gifts.find((g) => g.cost === spentCoins) : undefined) ||
      this.gifts.find((g) => g.cost === spentCoins);

    if (matchedGift) {
      const pickupSuffix = (h.id || 'KEN').slice(-4).toUpperCase();
      this.rewardModal = {
        mode: 'gift',
        title: matchedGift.name,
        subtitle: 'Thông tin quà lưu niệm đã đổi',
        code: `KEN-${matchedGift.codePrefix}-${pickupSuffix}`,
        image: matchedGift.image,
        conditionText: matchedGift.desc,
        validityText: 'Nhận trực tiếp tại quầy lễ tân KÉN',
        dateText: h.createdAtFormatted,
        coinsText,
        balanceAfterText,
        instructions: [
          'Xuất trình mã nhận quà và giao dịch này cho nhân viên tại quầy lễ tân KÉN.',
          'Nhân viên sẽ kiểm tra đối chiếu và trao phần quà cho bạn.',
        ],
      };
      return;
    }

    // 4. Khớp voucher qua tên, mã trong note hoặc mức Coins
    const matchedVoucherByMeta =
      this.vouchers.find(
        (v) =>
          lowerNote.includes(v.name.toLowerCase()) ||
          (v.code && lowerNote.includes(v.code.toLowerCase())),
      ) || this.vouchers.find((v) => v.cost === spentCoins);

    if (matchedVoucherByMeta) {
      this.rewardModal = {
        mode: 'voucher',
        title: matchedVoucherByMeta.name,
        subtitle: 'Thông tin voucher đã đổi',
        code: matchedVoucherByMeta.code,
        discountText: matchedVoucherByMeta.discountText,
        conditionText: matchedVoucherByMeta.conditionText,
        validityText: matchedVoucherByMeta.validityText || '30 ngày kể từ ngày đổi',
        dateText: h.createdAtFormatted,
        coinsText,
        balanceAfterText,
        instructions: [
          'Sao chép mã voucher bên trên để áp dụng khi đặt không gian tại KÉN.',
          'Nhập mã tại bước Xác nhận đặt chỗ (Booking Review) để được trừ trực tiếp vào hóa đơn.',
        ],
      };
      return;
    }

    // 5. Fallback cho giao dịch đổi thưởng khác
    const codeMatch = h.rawNote.match(/\b[A-Z0-9]{4,16}\b/);
    this.rewardModal = {
      mode: 'voucher',
      title: h.detail,
      subtitle: 'Chi tiết giao dịch đổi Coins',
      code: codeMatch?.[0],
      dateText: h.createdAtFormatted,
      coinsText,
      balanceAfterText,
      instructions: [
        'Giao dịch đổi thưởng đã được ghi nhận vào tài khoản của bạn.',
      ],
    };
  }

  copyRewardCode(code: string): void {
    if (!code) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(
        () => {
          this.copiedCode = true;
          setTimeout(() => { this.copiedCode = false; }, 2500);
        },
        () => {
          this.copiedCode = true;
        },
      );
    } else {
      this.copiedCode = true;
    }
  }

  useVoucherNow(code?: string): void {
    if (code && this.bookingState) {
      this.bookingState.set({ voucher: code });
    }
    this.closeRewardModal();
    this.router?.navigateByUrl('/spaces');
  }

  closeRewardModal(): void {
    this.rewardModal = null;
    this.copiedCode = false;
  }
}
