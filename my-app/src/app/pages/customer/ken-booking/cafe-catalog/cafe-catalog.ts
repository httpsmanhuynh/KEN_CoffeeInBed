import { Component, inject } from '@angular/core';
import { SmoothScrollService } from '../../../../core/smooth-scroll.service';
import { KEN_MENU, kenMoney } from '../booking-state';
import type { KenDrinkCategory, KenProduct } from '../booking-state';

@Component({ selector: 'app-ken-cafe-catalog', standalone: false, templateUrl: './cafe-catalog.html', styleUrl: './cafe-catalog.css' })
export class KenCafeCatalogPage {
  private readonly smoothScroll = (() => {
    try {
      return inject(SmoothScrollService, { optional: true });
    } catch {
      return null;
    }
  })();

  readonly products = KEN_MENU;
  category: 'all' | KenDrinkCategory = 'all';
  searchText = '';
  priceFilter: 'all' | 'under50' | 'from50' = 'all';
  sorting: 'group' | 'price-asc' | 'price-desc' = 'group';
  money = kenMoney;
  readonly categories: { id: 'all' | KenDrinkCategory; label: string }[] = [
    { id: 'all', label: 'Tất cả' }, { id: 'coffee', label: 'Cà phê & trà' },
    { id: 'refreshment', label: 'Giải khát' }, { id: 'bakery', label: 'Bánh & ăn nhẹ' }
  ];
  readonly sections = [
    { id: 'coffee' as KenDrinkCategory, no: '01', title: 'Cà phê & trà', subtitle: 'Một ly quen, hay một hương vị mới?' },
    { id: 'refreshment' as KenDrinkCategory, no: '02', title: 'Một chút tươi mát', subtitle: 'Nước uống & trái cây, cho buổi hẹn thêm vui.' },
    { id: 'bakery' as KenDrinkCategory, no: '03', title: 'Bánh & ăn nhẹ', subtitle: 'Nhâm nhi cùng cà phê, hoặc lót dạ một chút.' }
  ];

  get shownSections() {
    return this.sections.filter(s => this.category === 'all' || this.category === s.id).filter(s => this.forSection(s.id).length > 0);
  }
  forSection(category: KenDrinkCategory): KenProduct[] {
    const words = this.searchText.toLocaleLowerCase('vi-VN').trim();
    let items = this.products.filter(p => p.category === category && p.name.toLocaleLowerCase('vi-VN').includes(words));
    items = items.filter(p => this.priceFilter === 'all' || (this.priceFilter === 'under50' ? p.price < 50000 : p.price >= 50000));
    if (this.sorting !== 'group') items = [...items].sort((a, b) => this.sorting === 'price-asc' ? a.price - b.price : b.price - a.price);
    return items;
  }
  get resultCount(): number { return this.sections.reduce((n, s) => n + this.forSection(s.id).length, 0); }
  image = (p: KenProduct) => '/images/ken-flow/' + p.image;

  scrollToMenu(event?: Event): void {
    event?.preventDefault();
    if (this.smoothScroll) {
      this.smoothScroll.scrollTo('#ken-cafe-menu', { offset: -88, duration: 0.9 });
      return;
    }
    if (typeof document !== 'undefined') {
      const target = document.getElementById('ken-cafe-menu') || document.getElementById('ken-menu-catalog');
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
