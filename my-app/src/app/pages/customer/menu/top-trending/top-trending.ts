import { Component } from '@angular/core';

export type Category = 'Cà phê' | 'Trà & latte' | 'Giải khát' | 'Bánh & ăn nhẹ';
export type PriceKey = 'all' | 'lt40' | 'mid' | 'gt50';
export type SortKey = 'popular' | 'priceAsc' | 'priceDesc' | 'name';

export interface TrendingDish {
  id: string;
  rank: number;
  name: string;
  desc: string;
  price: number;
  image: string;
  category: Category;
  tag: string;
  ordersCount: number;
  rating: number;
  trendGrowth: string;
  badge: string;
}

const IMG = '/images/figma/';
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').toLowerCase();

@Component({
  selector: 'app-top-trending',
  standalone: false,
  templateUrl: './top-trending.html',
  styleUrl: './top-trending.css',
})
export class TopTrending {
  /**
   * Dữ liệu giả (Mock Data) chuẩn xác và phong phú cho bảng xếp hạng Top Trending của KÉN Coffee.
   * Xếp hạng theo thứ tự từ cao tới thấp (#1 đến #12) dựa trên lượt đặt và độ ưa chuộng.
   */
  readonly allTrendingDishes: TrendingDish[] = [
    {
      id: 'coldbrew',
      rank: 1,
      name: 'Cold Brew Truyền thống / Trái cây',
      desc: 'Chiết xuất lạnh 16 giờ từ hạt Cầu Đất nguyên chất, vị mát lành đậm hương trái cây chín mọng.',
      price: 50000,
      image: IMG + 'dish-cold-brew.png',
      category: 'Cà phê',
      tag: '👑 Quán Quân Tuần',
      ordersCount: 1840,
      rating: 4.9,
      trendGrowth: '+46% tuần này',
      badge: 'QUÁN QUÂN'
    },
    {
      id: 'bacxiu',
      rank: 2,
      name: 'Bạc Xỉu / Salted Caramel Coffee',
      desc: 'Sự hòa quyện êm dịu giữa cà phê đậm đà và sữa ngậy béo, điểm xuyết chút caramen muối.',
      price: 45000,
      image: IMG + 'dish-bac-xiu.png',
      category: 'Cà phê',
      tag: '🥈 Á Quân Bán Chạy',
      ordersCount: 1560,
      rating: 4.9,
      trendGrowth: '+38% tuần này',
      badge: 'Á QUÂN'
    },
    {
      id: 'matcha',
      rank: 3,
      name: 'Matcha Latte / Hojicha Latte',
      desc: 'Matcha Uji Nhật Bản kết hợp sữa tươi thanh trùng, ngọt dịu giải tỏa căng thẳng tức thì.',
      price: 55000,
      image: IMG + 'dish-matcha-hojicha.png',
      category: 'Trà & latte',
      tag: '🥉 Hạng Ba Vinh Danh',
      ordersCount: 1380,
      rating: 4.8,
      trendGrowth: '+32% tuần này',
      badge: 'TOP 3'
    },
    {
      id: 'croissant',
      rank: 4,
      name: 'Bánh sừng bò (Croissant) cơ bản',
      desc: 'Bánh ngàn lớp nướng nóng giòn tan, thơm nức bơ Pháp thượng hạng, món ăn nhẹ hoàn hảo.',
      price: 35000,
      image: IMG + 'dish-croissant.png',
      category: 'Bánh & ăn nhẹ',
      tag: '🥐 Bánh Bán Chạy Nhất',
      ordersCount: 1150,
      rating: 4.8,
      trendGrowth: '+28% tuần này',
      badge: 'TOP 4'
    },
    {
      id: 'oolong',
      rank: 5,
      name: 'Trà Oolong Macchiato / Trà Đào',
      desc: 'Hương trà oolong thượng hạng phủ lớp váng sữa macchiato mằn mặn ngậy béo mê mẩn.',
      price: 50000,
      image: IMG + 'dish-oolong.png',
      category: 'Trà & latte',
      tag: '🍵 Trà Được Yêu Thích',
      ordersCount: 980,
      rating: 4.8,
      trendGrowth: '+25% tuần này',
      badge: 'TOP 5'
    },
    {
      id: 'tiramisu',
      rank: 6,
      name: 'Tiramisu / Cheesecake',
      desc: 'Từng lớp kem phô mai Mascarpone mềm mượt thấm đượm hương rượu nhẹ và cà phê espresso.',
      price: 50000,
      image: IMG + 'dish-tiramisu.png',
      category: 'Bánh & ăn nhẹ',
      tag: '🍰 Ngọt Ngào Sáng Tạo',
      ordersCount: 890,
      rating: 4.8,
      trendGrowth: '+22% tuần này',
      badge: 'TOP 6'
    },
    {
      id: 'americano',
      rank: 7,
      name: 'Americano',
      desc: 'Vị cà phê thanh khiết, đắng dịu hậu ngọt sâu, là trợ thủ đắc lực cho những phiên làm việc sâu.',
      price: 40000,
      image: IMG + 'dish-americano.png',
      category: 'Cà phê',
      tag: '⚡ Tỉnh Táo Tức Thì',
      ordersCount: 820,
      rating: 4.7,
      trendGrowth: '+19% tuần này',
      badge: 'TOP 7'
    },
    {
      id: 'cam',
      rank: 8,
      name: 'Nước cam / Nước ép chanh dây',
      desc: '100% trái cây tươi vắt nguyên chất, dồi dào vitamin C giúp tái tạo tinh thần sảng khoái.',
      price: 45000,
      image: IMG + 'dish-nuoc-cam.png',
      category: 'Giải khát',
      tag: '🍊 Tươi Mát Tự Nhiên',
      ordersCount: 730,
      rating: 4.7,
      trendGrowth: '+18% tuần này',
      badge: 'TOP 8'
    },
    {
      id: 'mousse',
      rank: 9,
      name: 'Bánh Mousse',
      desc: 'Mousse trà xanh thanh tao hoặc chanh dây chua ngọt, kết cấu mượt mà tan ngay trên đầu lưỡi.',
      price: 45000,
      image: IMG + 'dish-mousse.png',
      category: 'Bánh & ăn nhẹ',
      tag: '🍮 Mềm Mịn Hấp Dẫn',
      ordersCount: 640,
      rating: 4.7,
      trendGrowth: '+15% tuần này',
      badge: 'TOP 9'
    },
    {
      id: 'soda',
      rank: 10,
      name: 'Soda trái cây',
      desc: 'Bọt ga sủi lăn tăn kết hợp siro trái cây nhập khẩu tươi mát, đánh thức mọi giác quan.',
      price: 45000,
      image: IMG + 'dish-soda.png',
      category: 'Giải khát',
      tag: '🫧 Sảng Khoái Đổi Vị',
      ordersCount: 560,
      rating: 4.6,
      trendGrowth: '+14% tuần này',
      badge: 'TOP 10'
    },
    {
      id: 'sandwich',
      rank: 11,
      name: 'Sandwich',
      desc: 'Bánh mì lúa mạch kẹp jambon phô mai và rau củ tươi, bữa ăn nhẹ tiện lợi khi chạy deadline.',
      price: 45000,
      image: IMG + 'dish-sandwich.png',
      category: 'Bánh & ăn nhẹ',
      tag: '🥪 Nhanh Gọn No Bụng',
      ordersCount: 490,
      rating: 4.6,
      trendGrowth: '+12% tuần này',
      badge: 'TOP 11'
    },
    {
      id: 'cafeden',
      rank: 12,
      name: 'Cà phê Đen / Sữa',
      desc: 'Hương vị cà phê phin truyền thống Việt Nam, đậm đà quen thuộc khó quên trong mỗi buổi sáng.',
      price: 40000,
      image: IMG + 'dish-ca-phe-den-sua.png',
      category: 'Cà phê',
      tag: '☕ Gu Mộc Quen Thuộc',
      ordersCount: 450,
      rating: 4.7,
      trendGrowth: '+10% tuần này',
      badge: 'TOP 12'
    }
  ];

  get afternoon(): TrendingDish[] {
    return this.allTrendingDishes.filter(d => ['matcha', 'bacxiu', 'oolong', 'croissant'].includes(d.id));
  }
  get trending(): TrendingDish[] {
    return this.allTrendingDishes.filter(d => !['matcha', 'bacxiu', 'oolong', 'croissant'].includes(d.id));
  }

  readonly categories: ('all' | Category)[] = ['all', 'Cà phê', 'Trà & latte', 'Giải khát', 'Bánh & ăn nhẹ'];
  readonly priceOptions: { key: PriceKey; label: string }[] = [
    { key: 'all', label: 'Mức giá: Tất cả' },
    { key: 'lt40', label: 'Mức giá: Dưới 40.000đ' },
    { key: 'mid', label: 'Mức giá: 40.000đ – 50.000đ' },
    { key: 'gt50', label: 'Mức giá: Trên 50.000đ' },
  ];
  readonly sortOptions: { key: SortKey; label: string }[] = [
    { key: 'popular', label: 'Bán chạy nhất (Thứ hạng)' },
    { key: 'priceAsc', label: 'Giá thấp đến cao' },
    { key: 'priceDesc', label: 'Giá cao đến thấp' },
    { key: 'name', label: 'Tên A–Z' },
  ];

  query = '';
  category: 'all' | Category = 'all';
  price: PriceKey = 'all';
  sort: SortKey = 'popular';

  /**
   * Danh sách món sau khi lọc và sắp xếp.
   */
  get filteredList(): TrendingDish[] {
    const q = norm(this.query.trim());
    const out = this.allTrendingDishes.filter(d =>
      (this.category === 'all' || d.category === this.category) &&
      (!q || norm(d.name + ' ' + d.desc + ' ' + d.tag).includes(q)) &&
      this.inPrice(d.price)
    );

    switch (this.sort) {
      case 'priceAsc':
        return [...out].sort((a, b) => a.price - b.price);
      case 'priceDesc':
        return [...out].sort((a, b) => b.price - a.price);
      case 'name':
        return [...out].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      default:
        return [...out].sort((a, b) => a.rank - b.rank);
    }
  }

  /**
   * Top 3 quán quân trên bục trao thưởng (Podium):
   * Rank 1: Cold Brew (Vàng)
   * Rank 2: Bạc Xỉu (Bạc)
   * Rank 3: Matcha Latte (Đồng)
   * Luôn hiển thị trên Bục Vinh Quang Top 3 của KÉN Coffee.
   */
  get podiumTop3(): { first: TrendingDish; second: TrendingDish; third: TrendingDish } {
    return {
      first: this.allTrendingDishes[0],
      second: this.allTrendingDishes[1],
      third: this.allTrendingDishes[2]
    };
  }

  get hasPodium(): boolean {
    return true;
  }

  get afternoonShown(): TrendingDish[] {
    return this.apply(this.afternoon);
  }

  get trendingShown(): TrendingDish[] {
    return this.apply(this.trending);
  }

  get total(): number {
    return this.filteredList.length;
  }

  get filtering(): boolean {
    return !!this.query.trim() || this.category !== 'all' || this.price !== 'all';
  }

  private apply(list: TrendingDish[]): TrendingDish[] {
    const q = norm(this.query.trim());
    const out = list.filter(d =>
      (this.category === 'all' || d.category === this.category) &&
      (!q || norm(d.name + ' ' + d.desc).includes(q)) &&
      this.inPrice(d.price));
    switch (this.sort) {
      case 'priceAsc': return [...out].sort((a, b) => a.price - b.price);
      case 'priceDesc': return [...out].sort((a, b) => b.price - a.price);
      case 'name': return [...out].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      default: return out;
    }
  }

  private inPrice(p: number): boolean {
    switch (this.price) {
      case 'lt40': return p < 40000;
      case 'mid': return p >= 40000 && p <= 50000;
      case 'gt50': return p > 50000;
      default: return true;
    }
  }

  setCategory(c: 'all' | Category): void {
    this.category = c;
  }

  reset(): void {
    this.query = '';
    this.category = 'all';
    this.price = 'all';
    this.sort = 'popular';
  }

  fmt(n: number): string {
    return n.toLocaleString('vi-VN') + 'đ';
  }

  fmtNumber(n: number): string {
    return n.toLocaleString('vi-VN');
  }

  label(c: 'all' | Category): string {
    return c === 'all' ? 'Tất cả' : c;
  }
}
