import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { CustomerApiService } from '../../../../core/customer-api.service';

type Category = 'Cà phê' | 'Trà & latte' | 'Giải khát' | 'Bánh & ăn nhẹ';
type PriceKey = 'all' | 'lt40' | 'mid' | 'gt50';
type SortKey = 'popular' | 'priceAsc' | 'priceDesc' | 'name';

interface Dish {
  id: string;
  rank: number;
  score?: number;
  name: string;
  desc: string;
  price: number;
  image: string;
  category: Category;
  tag: string;
}

function formatVariantLabels(variants: unknown): string {
  if (!Array.isArray(variants) || variants.length === 0) return '';
  const labels = variants
    .map((v: any) => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
      if (typeof v === 'object') {
        const candidate = v.name ?? v.label ?? v.title ?? v.value ?? '';
        return typeof candidate === 'string' || typeof candidate === 'number'
          ? String(candidate).trim()
          : '';
      }
      return '';
    })
    .filter(Boolean);
  return labels.length ? `Lựa chọn: ${labels.join(' · ')}` : '';
}

const IMG = '/images/addons/';
const norm = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').toLowerCase();

function mapDishCategory(raw: any): Category {
  const cat = String(raw?.category || '').toUpperCase();
  const sub = String(raw?.subCategory || raw?.sub_category || '').toUpperCase();
  const code = String(raw?.itemCode || raw?.item_code || '').toUpperCase();
  const name = norm(String(raw?.name || ''));
  if (
    cat === 'PASTRY' ||
    cat === 'SNACK' ||
    name.includes('banh') ||
    name.includes('croissant') ||
    name.includes('mousse') ||
    name.includes('tiramisu') ||
    name.includes('cheese') ||
    name.includes('sandwich') ||
    name.includes('trai cay')
  ) {
    return 'Bánh & ăn nhẹ';
  }
  if (
    sub === 'JUICE' ||
    sub === 'SODA' ||
    sub === 'BOTTLED_WATER' ||
    sub === 'FRUIT_TEA' ||
    code.startsWith('JUICE_') ||
    code.startsWith('SODA_') ||
    code === 'WATER_BOTTLE' ||
    name.includes('nuoc cam') ||
    name.includes('chanh day') ||
    name.includes('soda') ||
    name.includes('tinh khiet') ||
    name.includes('tra dao')
  ) {
    return 'Giải khát';
  }
  if (
    sub === 'TEA' ||
    sub === 'MATCHA' ||
    sub === 'HOJICHA' ||
    sub === 'CHOCOLATE' ||
    code.startsWith('TEA_') ||
    code.includes('MATCHA') ||
    code.includes('HOJICHA') ||
    code === 'CHOC_NONG' ||
    name.includes('tra') ||
    name.includes('matcha') ||
    name.includes('hojicha') ||
    name.includes('so-co-la')
  ) {
    return 'Trà & latte';
  }
  return 'Cà phê';
}

function mapDishImage(raw: any): string {
  const url =
    typeof raw?.imageUrl === 'string'
      ? raw.imageUrl
      : typeof raw?.image_url === 'string'
        ? raw.image_url
        : '';
  if (
    url.startsWith('/images/addons/') ||
    url.startsWith('http') ||
    url.startsWith('data:')
  ) {
    return url;
  }
  const code = String(raw?.itemCode || raw?.item_code || '').toUpperCase();
  const name = norm(String(raw?.name || ''));
  if (code.includes('MATCHA') && !name.includes('mousse')) return IMG + 'matcha-latte.png';
  if (code.includes('HOJICHA') || name.includes('hojicha')) return IMG + 'hojicha-latte.png';
  if (code === 'CF_SALTED_CARAMEL' || name.includes('caramel')) return IMG + 'cf-salted-caramel.png';
  if (code === 'CF_BAC_XIU' || name.includes('bac xiu')) return IMG + 'cf-bac-xiu.png';
  if (code === 'TEA_DAO' || name.includes('tra dao')) return IMG + 'tea-dao.png';
  if (code === 'TEA_LUC' || name.includes('luc tra')) return IMG + 'tea-luc.png';
  if (code === 'TEA_THAO_MOC' || name.includes('thao moc')) return IMG + 'tea-thao-moc.png';
  if (code === 'TEA_CHAI' || name.includes('chai an do')) return IMG + 'tea-chai.png';
  if (code.includes('OOLONG') || name.includes('oolong') || code.startsWith('TEA_') || name.includes('tra '))
    return IMG + 'tea-oolong-macchiato.png';
  if (code === 'BAKE_SCONE' || name.includes('bo xop')) return IMG + 'bake-scone.png';
  if (code === 'BAKE_CROISSANT' || name.includes('croissant')) return IMG + 'bake-croissant.png';
  if (code === 'CF_COLD_BREW_FRUIT' || (name.includes('cold brew') && name.includes('trai cay')))
    return IMG + 'cf-cold-brew-fruit.png';
  if (code.includes('COLD_BREW') || name.includes('cold brew')) return IMG + 'cf-cold-brew.png';
  if (code === 'CAKE_CHEESE' || name.includes('cheesecake')) return IMG + 'cake-cheese.png';
  if (code.startsWith('CAKE_') || name.includes('tiramisu') || name.includes('cheese'))
    return IMG + 'cake-tiramisu.png';
  if (code === 'JUICE_CHANH_DAY' || (name.includes('chanh day') && !name.includes('mousse')))
    return IMG + 'juice-chanh-day.png';
  if (code.startsWith('JUICE_') || name.includes('nuoc cam') || name.includes('chanh day'))
    return IMG + 'juice-cam.png';
  if (code === 'SNACK_SANDWICH' || name.includes('sandwich')) return IMG + 'snack-sandwich.png';
  if (code === 'MOUSSE_CHANH_DAY' || (name.includes('mousse') && name.includes('chanh day')))
    return IMG + 'mousse-chanh-day.png';
  if (code.startsWith('MOUSSE_') || name.includes('mousse')) return IMG + 'mousse-matcha.png';
  if (code === 'CF_AMERICANO' || name.includes('americano')) return IMG + 'cf-americano.png';
  if (code === 'CF_SUA' || name.includes('ca phe sua')) return IMG + 'cf-sua.png';
  if (code === 'CF_PHIN' || name.includes('phin')) return IMG + 'cf-phin.png';
  if (code === 'CF_ESPRESSO' || name.includes('espresso')) return IMG + 'cf-espresso.png';
  if (code === 'CHOC_NONG' || name.includes('so-co-la')) return IMG + 'choc-nong.png';
  if (code === 'SODA_TRAI_CAY' || name.includes('soda')) return IMG + 'soda-trai-cay.png';
  if (code === 'WATER_BOTTLE' || name.includes('tinh khiet')) return IMG + 'water-bottle.png';
  if (code === 'SNACK_FRUIT' || name.includes('trai cay')) return IMG + 'snack-fruit.png';
  if (code === 'BAKE_BISCOTTI' || name.includes('banh quy')) return IMG + 'bake-biscotti.png';
  if (code === 'BREAD_QUE' || name.includes('banh mi')) return IMG + 'bread-que.png';
  return IMG + 'cf-den.png';
}

@Component({
  selector: 'app-top-trending',
  standalone: false,
  templateUrl: './top-trending.html',
  styleUrl: './top-trending.css',
})
export class TopTrending implements OnInit {
  private readonly api = (() => {
    try {
      return inject(CustomerApiService, { optional: true });
    } catch {
      return null;
    }
  })();

  private readonly cdr = (() => {
    try {
      return inject(ChangeDetectorRef, { optional: true });
    } catch {
      return null;
    }
  })();

  afternoon: Dish[] = [
    {
      id: 'matcha',
      rank: 1,
      score: 0.96,
      name: 'Matcha Latte / Hojicha Latte',
      desc: 'Vị trà quyện sữa, cho một khoảng nghỉ chiều thật êm.',
      price: 55000,
      image: IMG + 'matcha-latte.png',
      category: 'Trà & latte',
      tag: 'Êm dịu buổi chiều',
    },
    {
      id: 'bacxiu',
      rank: 2,
      score: 0.92,
      name: 'Bạc Xỉu / Salted Caramel Coffee',
      desc: 'Cà phê và sữa, thêm chút ngọt cho buổi chiều chậm lại.',
      price: 45000,
      image: IMG + 'cf-bac-xiu.png',
      category: 'Cà phê',
      tag: 'Một chút ngọt ngào',
    },
    {
      id: 'oolong',
      rank: 3,
      score: 0.89,
      name: 'Trà Oolong Macchiato / Trà Đào',
      desc: 'Hương trà thanh nhẹ, hợp lúc muốn đổi vị giữa chiều.',
      price: 50000,
      image: IMG + 'tea-oolong-macchiato.png',
      category: 'Trà & latte',
      tag: 'Thanh mát, dễ nhâm nhi',
    },
    {
      id: 'croissant',
      rank: 4,
      score: 0.85,
      name: 'Bánh sừng bò (Croissant) cơ bản',
      desc: 'Một chiếc bánh thơm bơ để lót dạ cùng ly trà chiều.',
      price: 35000,
      image: IMG + 'bake-croissant.png',
      category: 'Bánh & ăn nhẹ',
      tag: 'Ăn nhẹ lúc xế chiều',
    },
  ];
  trending: Dish[] = [
    {
      id: 'coldbrew',
      rank: 5,
      score: 0.82,
      name: 'Cold Brew Truyền thống / Trái cây',
      desc: 'Thử một sắc thái cà phê khác, mát lành và đầy hương.',
      price: 50000,
      image: IMG + 'cf-cold-brew.png',
      category: 'Cà phê',
      tag: 'Cà phê',
    },
    {
      id: 'tiramisu',
      rank: 6,
      score: 0.79,
      name: 'Tiramisu / Cheesecake',
      desc: 'Một phần bánh mềm mịn cho cuộc trò chuyện thêm ngọt.',
      price: 50000,
      image: IMG + 'cake-tiramisu.png',
      category: 'Bánh & ăn nhẹ',
      tag: 'Bánh & ăn nhẹ',
    },
    {
      id: 'cam',
      rank: 7,
      score: 0.76,
      name: 'Nước cam / Nước ép chanh dây',
      desc: 'Vị trái cây chua ngọt cho một khoảng nghỉ tươi mới.',
      price: 45000,
      image: IMG + 'juice-cam.png',
      category: 'Giải khát',
      tag: 'Giải khát',
    },
    {
      id: 'sandwich',
      rank: 8,
      score: 0.73,
      name: 'Sandwich',
      desc: 'Lót dạ gọn nhẹ trước khi trở lại với công việc.',
      price: 45000,
      image: IMG + 'snack-sandwich.png',
      category: 'Bánh & ăn nhẹ',
      tag: 'Bánh & ăn nhẹ',
    },
    {
      id: 'cafeden',
      rank: 9,
      score: 0.7,
      name: 'Cà phê Đen / Sữa',
      desc: 'Hương cà phê quen thuộc cho những phút ngồi lại.',
      price: 40000,
      image: IMG + 'cf-den.png',
      category: 'Cà phê',
      tag: 'Cà phê',
    },
    {
      id: 'mousse',
      rank: 10,
      score: 0.68,
      name: 'Bánh Mousse',
      desc: 'Mềm nhẹ, vừa xinh cho một buổi hẹn nhâm nhi.',
      price: 45000,
      image: IMG + 'mousse-matcha.png',
      category: 'Bánh & ăn nhẹ',
      tag: 'Bánh & ăn nhẹ',
    },
    {
      id: 'americano',
      rank: 11,
      score: 0.65,
      name: 'Americano',
      desc: 'Vị cà phê rõ nét, dành cho lúc muốn chút đậm đà.',
      price: 40000,
      image: IMG + 'cf-americano.png',
      category: 'Cà phê',
      tag: 'Cà phê',
    },
    {
      id: 'soda',
      rank: 12,
      score: 0.61,
      name: 'Soda trái cây',
      desc: 'Một chút sủi bọt tươi vui để đổi nhịp buổi chiều.',
      price: 45000,
      image: IMG + 'soda-trai-cay.png',
      category: 'Giải khát',
      tag: 'Giải khát',
    },
  ];

  readonly categories: ('all' | Category)[] = [
    'all',
    'Cà phê',
    'Trà & latte',
    'Giải khát',
    'Bánh & ăn nhẹ',
  ];
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

  ngOnInit(): void {
    if (!this.api) return;
    forkJoin({
      rec: this.api
        .getTopTrendingRecommendations({ daypart: 'AFTERNOON', limit: '16' })
        .pipe(catchError(() => of(null))),
      products: this.api.getProducts().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ rec, products }) => {
        const prodList = Array.isArray(products)
          ? products.filter((p) => p && p.is_active !== false)
          : [];
        const prodById = new Map(prodList.map((p) => [String(p._id), p]));
        const recItems: any[] = Array.isArray(rec?.items) ? rec.items : [];

        // Ưu tiên danh sách F&B (loại bỏ thiết bị thuê PER_BOOKING)
        const fnbRec = recItems.filter(
          (it) =>
            it &&
            it.unit !== 'PER_BOOKING' &&
            String(it.itemType || '').toUpperCase() !== 'EQUIPMENT' &&
            String(it.category || '').toUpperCase() !== 'EQUIPMENT',
        );
        const source = fnbRec.length > 0 ? fnbRec : prodList;
        if (source.length === 0) return;

        const sortedSource = [...source].sort((a, b) => {
          const rA = Number(a?.rank);
          const rB = Number(b?.rank);
          if (Number.isFinite(rA) && rA > 0 && Number.isFinite(rB) && rB > 0 && rA !== rB) {
            return rA - rB;
          }
          const sA = Number(a?.trendingScore ?? a?.trending_score ?? a?.score ?? 0);
          const sB = Number(b?.trendingScore ?? b?.trending_score ?? b?.score ?? 0);
          return sB - sA;
        });

        const mapped: Dish[] = sortedSource.map((item, idx) => {
          const linked = item.productId ? prodById.get(String(item.productId)) : null;
          const cat = mapDishCategory(linked || item);
          const desc =
            linked?.description ||
            item.description ||
            formatVariantLabels(linked?.variants ?? item.variants) ||
            'Hương vị được khách hàng KÉN lựa chọn nhiều.';
          const rawScore = Number(item.trendingScore ?? item.trending_score ?? item.score ?? 0);
          return {
            id: String(item.itemCode || item.item_code || item.productId || item._id || idx),
            rank: idx + 1,
            score: Number.isFinite(rawScore) && rawScore > 0 ? rawScore : undefined,
            name: String(item.name || item.item_name || 'Món tại KÉN'),
            desc,
            price: Number(item.price ?? item.listedPrice ?? 0),
            image: mapDishImage(linked || item),
            category: cat,
            tag: item.reason ? String(item.reason) : cat,
          };
        });

        this.afternoon = mapped.slice(0, 4);
        this.trending = mapped.slice(4, 16);
        this.cdr?.markForCheck();
      },
    });
  }

  get allRanked(): Dish[] {
    const combined = [...this.afternoon, ...this.trending];
    return combined.map((d, idx) => ({ ...d, rank: d.rank || idx + 1 }));
  }

  get topThree(): Dish[] {
    return this.allRanked.slice(0, 3);
  }

  get gridEight(): Dish[] {
    return this.allRanked.slice(3, 11);
  }

  get afternoonShown(): Dish[] {
    return this.apply(this.afternoon);
  }
  get trendingShown(): Dish[] {
    return this.apply(this.trending);
  }
  get total(): number {
    return this.afternoonShown.length + this.trendingShown.length;
  }
  get filtering(): boolean {
    return !!this.query.trim() || this.category !== 'all' || this.price !== 'all';
  }

  private apply(list: Dish[]): Dish[] {
    const q = norm(this.query.trim());
    const out = list.filter(
      (d) =>
        (this.category === 'all' || d.category === this.category) &&
        (!q || norm(d.name + ' ' + d.desc).includes(q)) &&
        this.inPrice(d.price),
    );
    switch (this.sort) {
      case 'priceAsc':
        return [...out].sort((a, b) => a.price - b.price);
      case 'priceDesc':
        return [...out].sort((a, b) => b.price - a.price);
      case 'name':
        return [...out].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      default:
        return out;
    }
  }

  private inPrice(p: number): boolean {
    switch (this.price) {
      case 'lt40':
        return p < 40000;
      case 'mid':
        return p >= 40000 && p <= 50000;
      case 'gt50':
        return p > 50000;
      default:
        return true;
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
  formatScore(score?: number): string {
    if (score === undefined || score === null || Number.isNaN(score)) return '';
    return Number(score).toFixed(2);
  }
  label(c: 'all' | Category): string {
    return c === 'all' ? 'Tất cả' : c;
  }
}
