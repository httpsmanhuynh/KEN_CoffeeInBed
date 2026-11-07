import { Component } from '@angular/core';

interface Tx {
  iso: string; title: string; sub: string;
  points: string | null;   // null = không có điểm (hiện "—")
  coins: string; coinsNegative: boolean; note: string;
}

@Component({
  selector: 'app-points-tier',
  standalone: false,
  templateUrl: './points-tier.html',
  styleUrl: './points-tier.css',
})
export class PointsTierPage {
  // TODO: thay bằng API. Dữ liệu minh hoạ lấy đúng theo Figma.
  readonly transactions: Tx[] = [
    { iso: '2026-10-22', title: 'Focus Pod · #KEN-221026-018', sub: 'Hoàn thành · 145.000đ', points: '+14,5', coins: '+14', coinsNegative: false, note: 'Số dư: 3.250' },
    { iso: '2026-10-18', title: 'Phòng họp nhỏ · #KEN-181026-012', sub: 'Hoàn thành · 355.000đ', points: '+35,5', coins: '+35', coinsNegative: false, note: 'Số dư: 3.235,5' },
    { iso: '2026-10-10', title: 'Đổi Voucher giảm 20K', sub: 'Hoàn thành · Dùng 200 Coins', points: null, coins: '-200', coinsNegative: true, note: 'Coins còn: 650' },
  ];

  filterOpen = false;
  fromDate = '';
  toDate = '';
  private applied = { from: '', to: '' };

  get rows(): Tx[] {
    const { from, to } = this.applied;
    return this.transactions.filter(t => (!from || t.iso >= from) && (!to || t.iso <= to));
  }

  applyFilter(): void {
    if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
      [this.fromDate, this.toDate] = [this.toDate, this.fromDate];
    }
    this.applied = { from: this.fromDate, to: this.toDate };
    this.filterOpen = false;
  }
  clearFilter(): void { this.fromDate = this.toDate = ''; this.applied = { from: '', to: '' }; this.filterOpen = false; }
  fmtDate(iso: string): string { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
  logout(): void { console.log('Đăng xuất'); } // TODO: AuthService.logout()
}
