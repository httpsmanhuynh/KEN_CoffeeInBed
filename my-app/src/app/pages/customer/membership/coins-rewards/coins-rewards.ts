import { Component } from '@angular/core';

type HistoryTab = 'all' | 'pending' | 'earned' | 'spent';
type HistoryKind = 'pending' | 'earned' | 'spent';

@Component({
  selector: 'app-coins-rewards',
  standalone: false,
  templateUrl: './coins-rewards.html',
  styleUrl: './coins-rewards.css',
})
export class CoinsRewardsPage {
  // TODO: thay bằng API. Dữ liệu minh hoạ lấy đúng theo Figma.
  readonly balance = 650;
  activeTab: HistoryTab = 'all';

  readonly vouchers = [
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

  readonly history: { date: string; detail: string; amount: string; state: string; kind: HistoryKind; plus: boolean }[] = [
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
  logout(): void { console.log('Đăng xuất'); } // TODO: AuthService.logout()
  redeem(name: string, cost: number): void {
    alert(`Bạn đang chọn “${name}” (${cost} Coins). Đây là thao tác minh hoạ.`); // TODO: gọi API đổi quà
  }
}
