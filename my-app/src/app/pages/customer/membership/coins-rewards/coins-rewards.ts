import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/auth.service';
import { CustomerApiService } from '../../../../core/customer-api.service';

type HistoryTab = 'all' | 'pending' | 'earned' | 'spent';
type HistoryKind = 'pending' | 'earned' | 'spent';

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
  balance = 650;
  activeTab: HistoryTab = 'all';

  vouchers: Array<{ id?: string; type: string; name: string; desc: string; cost: number }> = [
    { type: 'Đồ uống', name: 'Voucher đồ uống 30.000đ', desc: 'Cho một ly yêu thích tại KÉN Kết Nối.', cost: 200 },
    { type: 'Không gian', name: 'Voucher không gian 70.000đ', desc: 'Dành cho dịch vụ đặt không gian tại KÉN.', cost: 450 },
    { type: 'Không gian', name: 'Voucher không gian 120.000đ', desc: 'Thêm một khoảng yên cho lịch hẹn mới.', cost: 800 },
  ];

  readonly gifts = [
    { image: '/images/figma/gift-so-tay.png', name: 'Sổ tay KÉN · Khoảng riêng', desc: 'Bìa kraft, giấy kem · Khổ A5.', cost: 350 },
    { image: '/images/figma/gift-tui-tote.png', name: 'Túi tote KÉN · Đi thật chậm', desc: 'Vải canvas tự nhiên · Một ngăn rộng.', cost: 600 },
    { image: '/images/figma/gift-coc-gom.png', name: 'Cốc gốm KÉN · Một nhịp yên', desc: 'Gốm men kem · Dung tích 300 ml.', cost: 900 },
  ];

  readonly tabs: { key: HistoryTab; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'pending', label: 'Đang xử lý' },
    { key: 'earned', label: 'Nhận Coins' },
    { key: 'spent', label: 'Dùng Coins' },
  ];

  history: { date: string; detail: string; amount: string; state: string; kind: HistoryKind; plus: boolean }[] = [
    { date: '23/10/2026', detail: 'Ghi nhận Coins · giao dịch minh hoạ', amount: '+80 Coins', state: 'Đang xử lý', kind: 'pending', plus: true },
    { date: '21/10/2026', detail: 'Đổi voucher đồ uống 30.000đ', amount: '−200 Coins', state: 'Đã đổi', kind: 'spent', plus: false },
    { date: '20/10/2026', detail: 'Đổi bookmark KÉN', amount: '−50 Coins', state: 'Đã nhận quà', kind: 'spent', plus: false },
    { date: '19/10/2026', detail: 'Nhận Coins · giao dịch minh hoạ', amount: '+100 Coins', state: 'Đã ghi nhận', kind: 'earned', plus: true },
  ];

  get filteredHistory() {
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
  ngOnInit(): void {
    if (!this.api || !this.auth) return;
    this.auth.ensureSession().subscribe({
      next: (user) => {
        if (!user) return;
        this.balance = user.coinsBalance;
        forkJoin({
          vouchers: this.api!.getVouchers(),
          history: this.api!.getLoyaltyHistory(),
        }).subscribe({
          next: ({ vouchers, history }) => {
            const coinVouchers = vouchers.filter((v) => (v.coins_cost || 0) > 0 && v.status === 'ACTIVE');
            if (coinVouchers.length) {
              this.vouchers = coinVouchers.map((v) => ({
                id: v._id,
                type: 'Không gian',
                name: v.description || `Voucher ${v.code}`,
                desc: `Mã ${v.code} · Giảm ${v.discount_type === 'PERCENT' ? v.discount_value + '%' : v.discount_value.toLocaleString('vi-VN') + 'đ'}`,
                cost: Number(v.coins_cost),
              }));
            }
            if (history?.transactions?.length) {
              this.history = history.transactions.map((tx) => {
                const d = new Date(tx.created_at);
                const plus = tx.coins_delta >= 0;
                return {
                  kind: (plus ? 'earned' : 'spent') as HistoryKind,
                  date: d.toLocaleDateString('vi-VN'),
                  detail: tx.note || tx.type,
                  amount: `${plus ? '+' : ''}${tx.coins_delta} Coins`,
                  state: `Số dư: ${tx.coins_after.toLocaleString('vi-VN')} Coins`,
                  plus,
                };
              });
            }
          },
        });
      },
    });
  }

  redeem(name: string, cost: number): void {
    const voucher = this.vouchers.find((v) => v.name === name);
    if (this.api && this.auth?.user && voucher?.id) {
      this.api.redeemCoins({ voucherId: voucher.id }).subscribe({
        next: (res) => {
          this.balance = res.coins ?? Math.max(0, this.balance - cost);
          if (this.auth?.user) this.auth.setUser({ ...this.auth.user, coinsBalance: this.balance });
          alert(`Đổi thành công “${name}”! Mã voucher đã được lưu vào ví của bạn.`);
        },
        error: (err) => {
          alert(err.error?.message || 'Không thể đổi voucher lúc này.');
        },
      });
      return;
    }
    alert(`Bạn đang chọn “${name}” (${cost} Coins). Đây là thao tác minh hoạ.`);
  }
}
