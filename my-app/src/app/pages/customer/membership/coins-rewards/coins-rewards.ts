import { Component } from '@angular/core';

@Component({
  selector: 'app-coins-rewards',
  standalone: false,
  templateUrl: './coins-rewards.html',
  styleUrl: './coins-rewards.css',
})
export class CoinsRewardsPage {
  activeTab: 'all' | 'pending' | 'earned' | 'spent' = 'all';
  readonly vouchers = [
    { type: 'Đồ uống', name: 'Voucher đồ uống 30.000đ', desc: 'Cho một ly yêu thích tại KÉN Kết Nối.', cost: 200, status: 'Đủ Coins', available: true },
    { type: 'Không gian', name: 'Voucher không gian 70.000đ', desc: 'Dành cho dịch vụ đặt chỗ tại KÉN.', cost: 450, status: 'Đủ Coins', available: true },
    { type: 'Không gian', name: 'Voucher không gian 120.000đ', desc: 'Thêm một khoảng yên cho lịch hẹn mới.', cost: 800, status: 'Thiếu 150', available: false },
  ];
  readonly gifts = [
    { image: 'book', name: 'Sổ tay KÉN · Khoảng riêng', desc: 'Bìa kraft, giấy kem · Khổ A5.', cost: 350, available: true },
    { image: 'tote', name: 'Túi tote KÉN · Đi thật chậm', desc: 'Vải canvas tự nhiên · Một ngăn rộng.', cost: 600, available: true },
    { image: 'mug', name: 'Cốc gốm KÉN · Một nhịp yên', desc: 'Gốm men kem · Dung tích 300 ml.', cost: 900, available: false },
  ];
  readonly history = [
    { date: '23/10/2026', detail: 'Ghi nhận Coins · giao dịch minh họa', amount: '+80 Coins', state: 'Đang xử lý', kind: 'pending' },
    { date: '21/10/2026', detail: 'Đổi voucher đồ uống 30.000đ', amount: '−200 Coins', state: 'Đã đổi', kind: 'spent' },
    { date: '20/10/2026', detail: 'Đổi bookmark KÉN', amount: '−50 Coins', state: 'Đã nhận quà', kind: 'spent' },
    { date: '19/10/2026', detail: 'Nhận Coins · giao dịch minh họa', amount: '+100 Coins', state: 'Đã ghi nhận', kind: 'earned' },
  ];
  get filteredHistory() { return this.activeTab === 'all' ? this.history : this.history.filter(x => x.kind === this.activeTab); }
  redeem(name: string, cost: number): void { alert(`Bạn đang chọn “${name}” (${cost} Coins). Đây là thao tác minh họa.`); }
}
