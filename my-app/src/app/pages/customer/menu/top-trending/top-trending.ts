import { Component } from '@angular/core';

type Category = 'Cà phê' | 'Trà & latte' | 'Giải khát' | 'Bánh & ăn nhẹ';
type PriceKey = 'all' | 'lt40' | 'mid' | 'gt50';
type SortKey = 'popular' | 'priceAsc' | 'priceDesc' | 'name';

interface Dish {
  id: string; name: string; desc: string; price: number; image: string;
  category: Category; tag: string;
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
  // TODO: thay bằng API menu. Nội dung theo Figma 632:11365 (menu tham khảo, không phải bảng xếp hạng).
  readonly afternoon: Dish[] = [
    { id: 'matcha', name: 'Matcha Latte / Hojicha Latte', desc: 'Vị trà quyện sữa, cho một khoảng nghỉ chiều thật êm.', price: 55000, image: IMG + 'dish-matcha-hojicha.png', category: 'Trà & latte', tag: 'Êm dịu buổi chiều' },
    { id: 'bacxiu', name: 'Bạc Xỉu / Salted Caramel Coffee', desc: 'Cà phê và sữa, thêm chút ngọt cho buổi chiều chậm lại.', price: 45000, image: IMG + 'dish-bac-xiu.png', category: 'Cà phê', tag: 'Một chút ngọt ngào' },
    { id: 'oolong', name: 'Trà Oolong Macchiato / Trà Đào', desc: 'Hương trà thanh nhẹ, hợp lúc muốn đổi vị giữa chiều.', price: 50000, image: IMG + 'dish-oolong.png', category: 'Trà & latte', tag: 'Thanh mát, dễ nhâm nhi' },
    { id: 'croissant', name: 'Bánh sừng bò (Croissant) cơ bản', desc: 'Một chiếc bánh thơm bơ để lót dạ cùng ly trà chiều.', price: 35000, image: IMG + 'dish-croissant.png', category: 'Bánh & ăn nhẹ', tag: 'Ăn nhẹ lúc xế chiều' },
  ];
  readonly trending: Dish[] = [
    { id: 'coldbrew', name: 'Cold Brew Truyền thống / Trái cây', desc: 'Thử một sắc thái cà phê khác, mát lành và đầy hương.', price: 50000, image: IMG + 'dish-cold-brew.png', category: 'Cà phê', tag: 'Cà phê' },
    { id: 'tiramisu', name: 'Tiramisu / Cheesecake', desc: 'Một phần bánh mềm mịn cho cuộc trò chuyện thêm ngọt.', price: 50000, image: IMG + 'dish-tiramisu.png', category: 'Bánh & ăn nhẹ', tag: 'Bánh & ăn nhẹ' },
    { id: 'cam', name: 'Nước cam / Nước ép chanh dây', desc: 'Vị trái cây chua ngọt cho một khoảng nghỉ tươi mới.', price: 45000, image: IMG + 'dish-nuoc-cam.png', category: 'Giải khát', tag: 'Giải khát' },
    { id: 'sandwich', name: 'Sandwich', desc: 'Lót dạ gọn nhẹ trước khi trở lại với công việc.', price: 45000, image: IMG + 'dish-sandwich.png', category: 'Bánh & ăn nhẹ', tag: 'Bánh & ăn nhẹ' },
    { id: 'cafeden', name: 'Cà phê Đen / Sữa', desc: 'Hương cà phê quen thuộc cho những phút ngồi lại.', price: 40000, image: IMG + 'dish-ca-phe-den-sua.png', category: 'Cà phê', tag: 'Cà phê' },
    { id: 'mousse', name: 'Bánh Mousse', desc: 'Mềm nhẹ, vừa xinh cho một buổi hẹn nhâm nhi.', price: 45000, image: IMG + 'dish-mousse.png', category: 'Bánh & ăn nhẹ', tag: 'Bánh & ăn nhẹ' },
    { id: 'americano', name: 'Americano', desc: 'Vị cà phê rõ nét, dành cho lúc muốn chút đậm đà.', price: 40000, image: IMG + 'dish-americano.png', category: 'Cà phê', tag: 'Cà phê' },
    { id: 'soda', name: 'Soda trái cây', desc: 'Một chút sủi bọt tươi vui để đổi nhịp buổi chiều.', price: 45000, image: IMG + 'dish-soda.png', category: 'Giải khát', tag: 'Giải khát' },
  ];

  readonly categories: ('all' | Category)[] = ['all', 'Cà phê', 'Trà & latte', 'Giải khát', 'Bánh & ăn nhẹ'];
  readonly priceOptions: { key: PriceKey; label: string }[] = [
    { key: 'all', label: 'Mức giá: Tất cả' },
    { key: 'lt40', label: 'Mức giá: Dưới 40.000đ' },
    { key: 'mid', label: 'Mức giá: 40.000đ – 50.000đ' },
    { key: 'gt50', label: 'Mức giá: Trên 50.000đ' },
  ];
  readonly sortOptions: { key: SortKey; label: string }[] = [
    { key: 'popular', label: 'Phổ biến nhất' },
    { key: 'priceAsc', label: 'Giá thấp đến cao' },
    { key: 'priceDesc', label: 'Giá cao đến thấp' },
    { key: 'name', label: 'Tên A–Z' },
  ];

  query = '';
  category: 'all' | Category = 'all';
  price: PriceKey = 'all';
  sort: SortKey = 'popular';

  get afternoonShown(): Dish[] { return this.apply(this.afternoon); }
  get trendingShown(): Dish[] { return this.apply(this.trending); }
  get total(): number { return this.afternoonShown.length + this.trendingShown.length; }
  get filtering(): boolean { return !!this.query.trim() || this.category !== 'all' || this.price !== 'all'; }

  private apply(list: Dish[]): Dish[] {
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

  setCategory(c: 'all' | Category): void { this.category = c; }
  reset(): void { this.query = ''; this.category = 'all'; this.price = 'all'; this.sort = 'popular'; }
  fmt(n: number): string { return n.toLocaleString('vi-VN') + 'đ'; }
  label(c: 'all' | Category): string { return c === 'all' ? 'Tất cả' : c; }
}
