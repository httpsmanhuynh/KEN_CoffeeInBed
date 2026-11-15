import { Component } from '@angular/core';

export interface ForecastItem {
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
    { date: '28/10', value: 430, height: 82.56, top: 69.44, textTop: 47.44 },
    { date: '29/10', value: 452, height: 86.78, top: 65.22, textTop: 43.22 },
    { date: '30/10', value: 486, height: 93.31, top: 58.69, textTop: 36.69 },
    { date: '31/10', value: 610, height: 117.12, top: 34.88, textTop: 12.88 },
    { date: '01/11', value: 590, height: 113.28, top: 38.72, textTop: 16.72 },
    { date: '02/11', value: 520, height: 99.84, top: 52.16, textTop: 30.16 },
    { date: '03/11', value: 560, height: 107.52, top: 44.48, textTop: 22.48, isForecast: true },
  ];

  readonly items: ForecastItem[] = [
    {
      name: 'Cà phê Đen / Sữa',
      code: 'DU-01',
      quantity: 96,
      range: 'Khuyên dùng: 92 - 100 ly',
      change: 8,
      action: 'Tăng mức chuẩn bị',
      category: 'Đồ uống',
    },
    {
      name: 'Matcha Latte',
      code: 'DU-06',
      quantity: 84,
      range: 'Khuyên dùng: 80 - 88 ly',
      change: 0,
      action: 'Giữ mức chuẩn bị',
      category: 'Đồ uống',
    },
    {
      name: 'Bạc Xỉu',
      code: 'DU-03',
      quantity: 72,
      range: 'Khuyên dùng: 68 - 76 ly',
      change: -5,
      action: 'Giảm mức chuẩn bị',
      category: 'Đồ uống',
    },
    {
      name: 'Trà Đào',
      code: 'DU-05',
      quantity: 60,
      range: 'Khuyên dùng: 57 - 63 ly',
      change: 0,
      action: 'Giữ mức chuẩn bị',
      category: 'Đồ uống',
    },
    {
      name: 'Americano',
      code: 'DU-02',
      quantity: 64,
      range: 'Khuyên dùng: 61 - 67 ly',
      change: 0,
      action: 'Giữ mức chuẩn bị',
      category: 'Đồ uống',
    },
    {
      name: 'Cold Brew',
      code: 'DU-04',
      quantity: 48,
      range: 'Khuyên dùng: 45 - 51 ly',
      change: -8,
      action: 'Giảm mức chuẩn bị',
      category: 'Đồ uống',
    },
    {
      name: 'Hojicha',
      code: 'DU-07',
      quantity: 36,
      range: 'Khuyên dùng: 34 - 38 ly',
      change: 0,
      action: 'Giữ mức chuẩn bị',
      category: 'Đồ uống',
    },
    {
      name: 'Croissant',
      code: 'BN-01',
      quantity: 40,
      range: 'Khuyên dùng: 37 - 43 phần',
      change: 12,
      action: 'Tăng mức chuẩn bị',
      category: 'Bánh',
    },
    {
      name: 'Mousse',
      code: 'BN-02',
      quantity: 24,
      range: 'Biên độ: cần bổ sung lịch sử',
      change: null,
      action: 'Kiểm tra trước khi chuẩn bị',
      category: 'Bánh',
    },
    {
      name: 'Tiramisu',
      code: 'BN-03',
      quantity: 36,
      range: 'Khuyên dùng: 34 - 38 phần',
      change: -4,
      action: 'Giảm mức chuẩn bị',
      category: 'Bánh',
    },
  ];

  get filteredItems(): ForecastItem[] {
    const query = this.search.trim().toLowerCase();
    let res = this.items.filter(
      (item) =>
        (!query || item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query)) &&
        (this.category === 'Tất cả' || item.category === this.category),
    );

    if (this.sort === 'Số lượng tăng dần') {
      res = [...res].sort((a, b) => a.quantity - b.quantity);
    } else if (this.sort === 'Số lượng giảm dần') {
      res = [...res].sort((a, b) => b.quantity - a.quantity);
    }
    return res;
  }

  get totalQuantity(): number {
    return this.filteredItems.reduce((sum, item) => sum + item.quantity, 0);
  }

  get totalDrinkQuantity(): number {
    return this.filteredItems
      .filter((i) => i.category === 'Đồ uống')
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  get totalFoodQuantity(): number {
    return this.filteredItems
      .filter((i) => i.category === 'Bánh')
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  get needCheckCount(): number {
    return this.filteredItems.filter((i) => i.change === null).length;
  }

  abs(val: number): number {
    return Math.abs(val);
  }
}
