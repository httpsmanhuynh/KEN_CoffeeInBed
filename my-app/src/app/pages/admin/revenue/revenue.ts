import { Component } from '@angular/core';

export interface RevenueTransaction {
  date: string;
  time: string;
  txCode: string;
  orderCode: string;
  source: string;
  sourceType: string;
  type: 'Thu' | 'Hoàn tiền';
  amount: number;
  status: 'Thành công' | 'Đang xử lý';
}

@Component({
  selector: 'app-revenue',
  standalone: false,
  styleUrl: './revenue.css',
  templateUrl: './revenue.html',
})
export class Revenue {
  dateRange = '17/10 – 23/10/2026';
  selectedArea = 'Tất cả khu vực';
  selectedSource = 'Tất cả nguồn thu';
  selectedType = 'Tất cả';
  searchTerm = '';

  readonly dailyData = [
    { date: '17/10', valText: '4,8', height: 96, top: 80, valTop: 56, left: 65, textLeft: 49 },
    { date: '18/10', valText: '5,2', height: 104, top: 72, valTop: 48, left: 152, textLeft: 136 },
    { date: '19/10', valText: '5,6', height: 112, top: 64, valTop: 40, left: 239, textLeft: 223 },
    { date: '20/10', valText: '6,4', height: 128, top: 48, valTop: 24, left: 326, textLeft: 310 },
    { date: '21/10', valText: '5,8', height: 116, top: 60, valTop: 36, left: 413, textLeft: 397 },
    { date: '22/10', valText: '7,2', height: 144, top: 32, valTop: 8, left: 500, textLeft: 484 },
    { date: '23/10', valText: '6,6', height: 132, top: 44, valTop: 20, left: 587, textLeft: 571, isHighlight: true },
  ];

  readonly areaBreakdown = [
    { name: 'KÉN Tập Trung', percent: '57,7%', amount: '24.000.000đ', barWidth: 57.7, color: 'var(--color-orange-21-2, #4A3123)' },
    { name: 'KÉN Tái Tạo', percent: '27,9%', amount: '11.600.000đ', barWidth: 27.9, color: 'var(--color-orange-45-2, #A9763F)' },
    { name: 'KÉN Kết Nối', percent: '14,4%', amount: '6.000.000đ', barWidth: 14.4, color: 'var(--color-orange-54-2, #E3A52F)' },
  ];

  readonly transactions: RevenueTransaction[] = [
    {
      date: '23/10/2026',
      time: '18:42',
      txCode: 'TX-2310-164',
      orderCode: 'BK-2310-089',
      source: 'KÉN Tập Trung',
      sourceType: 'Đặt chỗ',
      type: 'Thu',
      amount: 150000,
      status: 'Thành công',
    },
    {
      date: '23/10/2026',
      time: '18:15',
      txCode: 'TX-2310-163',
      orderCode: 'BK-2310-088',
      source: 'KÉN Tái Tạo',
      sourceType: 'Đặt chỗ',
      type: 'Thu',
      amount: 260000,
      status: 'Thành công',
    },
    {
      date: '23/10/2026',
      time: '17:56',
      txCode: 'TX-2310-162',
      orderCode: 'CF-2310-064',
      source: 'KÉN Kết Nối',
      sourceType: 'Café walk-in',
      type: 'Thu',
      amount: 85000,
      status: 'Thành công',
    },
    {
      date: '23/10/2026',
      time: '17:30',
      txCode: 'RF-2310-006',
      orderCode: 'BK-2110-052',
      source: 'KÉN Tập Trung',
      sourceType: 'Hoàn theo đơn gốc',
      type: 'Hoàn tiền',
      amount: -100000,
      status: 'Thành công',
    },
    {
      date: '23/10/2026',
      time: '17:12',
      txCode: 'TX-2310-161',
      orderCode: 'BK-2310-087',
      source: 'KÉN Tập Trung',
      sourceType: 'Đặt chỗ',
      type: 'Thu',
      amount: 420000,
      status: 'Thành công',
    },
    {
      date: '23/10/2026',
      time: '16:48',
      txCode: 'TX-2310-160',
      orderCode: 'BK-2310-086',
      source: 'KÉN Tái Tạo',
      sourceType: 'Đặt chỗ',
      type: 'Thu',
      amount: 120000,
      status: 'Thành công',
    },
    {
      date: '23/10/2026',
      time: '16:25',
      txCode: 'TX-2310-159',
      orderCode: 'CF-2310-063',
      source: 'KÉN Kết Nối',
      sourceType: 'Café walk-in',
      type: 'Thu',
      amount: 55000,
      status: 'Thành công',
    },
  ];

  get filteredTransactions(): RevenueTransaction[] {
    const q = this.searchTerm.trim().toLowerCase();
    return this.transactions.filter((t) => {
      const matchQuery =
        !q ||
        t.txCode.toLowerCase().includes(q) ||
        t.orderCode.toLowerCase().includes(q) ||
        t.source.toLowerCase().includes(q);
      const matchType = this.selectedType === 'Tất cả' || t.type === this.selectedType;
      const matchArea = this.selectedArea === 'Tất cả khu vực' || t.source === this.selectedArea;
      return matchQuery && matchType && matchArea;
    });
  }

  formatAmount(amount: number): string {
    const prefix = amount > 0 ? '+' : '−';
    const absVal = Math.abs(amount).toLocaleString('vi-VN');
    return `${prefix}${absVal}đ`;
  }

  exportReport(): void {
    alert('Đang tạo và tải báo cáo doanh thu định dạng Excel / PDF...');
  }
}
