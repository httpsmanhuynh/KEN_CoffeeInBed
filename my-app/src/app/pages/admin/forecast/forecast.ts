import { Component } from '@angular/core';

interface ForecastItem {
  name: string;
  code: string;
  quantity: number;
  range: string;
  change: number | null;
  action: string;
  category: 'Đồ uống' | 'Bánh';
}

@Component({
  selector: 'app-forecast',
  standalone: false,
  styleUrl: './forecast.css',
  templateUrl: './forecast.html',
})
export class Forecast {
  forecastDate = '03/11/2026';
  search = '';
  category = 'Tất cả';
  sort = 'Mặc định';

  readonly trend = [
    { date: '28/10', value: 430 },
    { date: '29/10', value: 452 },
    { date: '30/10', value: 486 },
    { date: '31/10', value: 610 },
    { date: '01/11', value: 590 },
    { date: '02/11', value: 520 },
    { date: '03/11', value: 560 },
  ];

  readonly items: ForecastItem[] = [
    { name: 'Cà phê Đen / Sữa', code: 'DU-01', quantity: 96, range: '92 - 100 ly', change: 8, action: 'Tăng mức chuẩn bị', category: 'Đồ uống' },
    { name: 'Matcha Latte', code: 'DU-06', quantity: 84, range: '80 - 88 ly', change: 0, action: 'Giữ mức chuẩn bị', category: 'Đồ uống' },
    { name: 'Bạc Xỉu', code: 'DU-03', quantity: 72, range: '68 - 76 ly', change: -5, action: 'Giảm mức chuẩn bị', category: 'Đồ uống' },
    { name: 'Trà Đào', code: 'DU-05', quantity: 60, range: '57 - 63 ly', change: 0, action: 'Giữ mức chuẩn bị', category: 'Đồ uống' },
    { name: 'Americano', code: 'DU-02', quantity: 64, range: '61 - 67 ly', change: 0, action: 'Giữ mức chuẩn bị', category: 'Đồ uống' },
    { name: 'Cold Brew', code: 'DU-04', quantity: 48, range: '45 - 51 ly', change: -8, action: 'Giảm mức chuẩn bị', category: 'Đồ uống' },
    { name: 'Hojicha', code: 'DU-07', quantity: 36, range: '34 - 38 ly', change: 0, action: 'Giữ mức chuẩn bị', category: 'Đồ uống' },
    { name: 'Croissant', code: 'BN-01', quantity: 40, range: '37 - 43 phần', change: 12, action: 'Tăng mức chuẩn bị', category: 'Bánh' },
    { name: 'Mousse', code: 'BN-02', quantity: 24, range: 'Chưa có dữ liệu', change: null, action: 'Kiểm tra trước khi chuẩn bị', category: 'Bánh' },
    { name: 'Tiramisu', code: 'BN-03', quantity: 36, range: '34 - 38 phần', change: -4, action: 'Giảm mức chuẩn bị', category: 'Bánh' },
  ];

  get filteredItems(): ForecastItem[] {
    const query = this.search.trim().toLowerCase();
    return this.items.filter((item) =>
      (!query || item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query)) &&
      (this.category === 'Tất cả' || item.category === this.category)
    );
  }

  get maxTrend(): number {
    return Math.max(...this.trend.map((item) => item.value));
  }

  barHeight(value: number): number {
    return Math.round((value / this.maxTrend) * 100);
  }

  changeLabel(change: number | null): string {
    return change === null ? 'Chưa có dữ liệu' : `${change > 0 ? '↑' : change < 0 ? '↓' : '→'} ${Math.abs(change)}%`;
  }
}
