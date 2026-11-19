import { ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CustomerApiService } from '../../../core/customer-api.service';
import { SuggestionPopupService } from '../../services/suggestion-popup.service';

interface Slide { id: string; name: string; price: string; desc: string; image: string; }

const SLIDE_MS = 5000;
const TICK_MS = 50;
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function mapPopupImage(item: any): string {
  const url = typeof item?.imageUrl === 'string' ? item.imageUrl.trim() : '';
  if (url.startsWith('/images/addons/') || url.startsWith('http') || url.startsWith('data:')) {
    return url;
  }
  const code = String(item?.itemCode || '').toUpperCase();
  const name = String(item?.name || '').toLocaleLowerCase('vi-VN');
  if (code.includes('MATCHA') && !name.includes('mousse')) return '/images/addons/matcha-latte.png';
  if (code.includes('HOJICHA') || name.includes('hojicha')) return '/images/addons/hojicha-latte.png';
  if (code === 'CF_SALTED_CARAMEL' || name.includes('caramel')) return '/images/addons/cf-salted-caramel.png';
  if (code === 'CF_BAC_XIU' || name.includes('bạc xỉu')) return '/images/addons/cf-bac-xiu.png';
  if (code.includes('COLD_BREW') || name.includes('cold brew')) return '/images/addons/cf-cold-brew.png';
  if (code.includes('OOLONG') || name.includes('oolong') || code.startsWith('TEA_')) return '/images/addons/tea-oolong-macchiato.png';
  if (code === 'BAKE_CROISSANT' || name.includes('croissant')) return '/images/addons/bake-croissant.png';
  if (code.startsWith('CAKE_') || name.includes('tiramisu') || name.includes('cheese')) return '/images/addons/cake-tiramisu.png';
  if (code.startsWith('JUICE_') || name.includes('cam') || name.includes('chanh')) return '/images/addons/juice-cam.png';
  if (code === 'CF_SUA' || name.includes('cà phê sữa') || name.includes('cafe sữa')) return '/images/addons/cf-sua.png';
  if (code === 'CF_AMERICANO' || name.includes('americano')) return '/images/addons/cf-americano.png';
  if (code.startsWith('MOUSSE_') || name.includes('mousse')) return '/images/addons/mousse-matcha.png';
  return '/images/addons/cf-den.png';
}

const FALLBACK_SLIDES: Slide[] = [
  { id: 'matcha', name: 'Matcha Latte / Hojicha Latte', price: '55.000đ', image: '/images/addons/matcha-latte.png',
    desc: 'Một chút trà thơm quyện cùng sữa dịu nhẹ. Vừa hay cho lúc bạn muốn chậm lại giữa buổi chiều.' },
  { id: 'bacxiu', name: 'Bạc Xỉu / Salted Caramel Coffee', price: '45.000đ', image: '/images/addons/cf-bac-xiu.png',
    desc: 'Cà phê quyện sữa, ngọt dịu vừa đủ. Một lựa chọn để nhâm nhi cùng câu chuyện còn đang dang dở.' },
];

@Component({
  selector: 'app-suggestion-popup',
  standalone: false,
  templateUrl: './suggestion-popup.html',
  styleUrl: './suggestion-popup.css',
})
export class SuggestionPopup implements OnInit, OnDestroy {
  protected readonly popup = inject(SuggestionPopupService);
  private readonly router = inject(Router);
  private readonly api = inject(CustomerApiService, { optional: true });
  private readonly cdr = inject(ChangeDetectorRef, { optional: true });

  @ViewChild('dialog') dialog?: ElementRef<HTMLElement>;

  slides: Slide[] = [];

  ngOnInit(): void {
    if (!this.api) {
      this.slides = FALLBACK_SLIDES;
      this.go(0);
      return;
    }
    this.api.getRecommendations({ daypart: 'AFTERNOON', limit: '4' }).subscribe({
      next: (res) => {
        const items: any[] = Array.isArray(res?.items) ? res.items.filter((it: any) => it && it.unit !== 'PER_BOOKING') : [];
        if (items.length === 0) {
          this.slides = FALLBACK_SLIDES;
          this.go(0);
          return;
        }
        this.slides = items.map((it, idx) => ({
          id: String(it.itemCode || it.productId || idx),
          name: String(it.name || 'Món gợi ý KÉN'),
          price: `${Number(it.price ?? it.listedPrice ?? 0).toLocaleString('vi-VN')}đ`,
          desc: String(it.reason || 'Gợi ý phù hợp cho khung giờ này tại KÉN.'),
          image: mapPopupImage(it),
        }));
        this.go(0);
      },
      error: () => {
        this.slides = FALLBACK_SLIDES;
        this.go(0);
      },
    });
  }

  index = 0;
  progress = 0;          // 0..1 của slide hiện tại
  readonly slideDurationMs = SLIDE_MS;
  private timer?: ReturnType<typeof setInterval>;
  private lastFocus: Element | null = null;
  private wasOpen = false;
  private lastOpenVersion = 0;

  constructor() {
    effect(() => {
      const open = this.popup.isOpen();
      const version = this.popup.openVersion();
      if (open && (!this.wasOpen || version !== this.lastOpenVersion)) this.onOpen();
      else if (!open && this.wasOpen) this.onClose();
      this.wasOpen = open;
      this.lastOpenVersion = version;
    });
  }

  /** Mảng 1 phần tử để @for dựng lại (và chạy animation) mỗi khi đổi món. */
  current: Slide[] = [];
  get counter(): string { return `${String(this.index + 1).padStart(2, '0')} / ${String(this.slides.length).padStart(2, '0')} · Gợi ý buổi chiều`; }

  /** Độ rộng (%) phần đã chạy của thanh tiến trình thứ i. */
  fill(i: number): number {
    if (i < this.index) return 100;
    if (i === this.index) return Math.round(this.progress * 100);
    return 0;
  }

  next(): void { if (this.slides.length) this.go((this.index + 1) % this.slides.length); }
  prev(): void { if (this.slides.length) this.go((this.index - 1 + this.slides.length) % this.slides.length); }
  private go(i: number): void {
    if (!this.slides.length) return;
    this.index = i;
    this.progress = 0;
    this.current = [this.slides[i]];
    this.cdr?.markForCheck();
  }

  close(): void { this.popup.hide(); }
  explore(): void { this.close(); this.router.navigateByUrl('/top-trending'); }
  later(): void { this.close(); this.router.navigateByUrl('/menu'); }
  onBackdrop(ev: MouseEvent): void { if (ev.target === ev.currentTarget) this.close(); }

  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (!this.popup.isOpen()) return;
    if (ev.key === 'Escape') { ev.preventDefault(); this.close(); }
    else if (ev.key === 'ArrowRight') this.next();
    else if (ev.key === 'ArrowLeft') this.prev();
    else if (ev.key === 'Tab') this.trapTab(ev);
  }

  private trapTab(ev: KeyboardEvent): void {
    const root = this.dialog?.nativeElement;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    const active = document.activeElement;
    if (ev.shiftKey && (active === first || active === root)) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && active === last) { ev.preventDefault(); first.focus(); }
  }

  private onOpen(): void {
    clearInterval(this.timer);
    this.go(0);
    this.lastFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      this.timer = setInterval(() => {
        this.progress += TICK_MS / SLIDE_MS;
        if (this.progress >= 1) this.next();
        this.cdr?.markForCheck();
      }, TICK_MS);
    } else {
      this.progress = 1;
      this.cdr?.markForCheck();
    }
    setTimeout(() => this.dialog?.nativeElement.focus());
  }

  private onClose(): void {
    clearInterval(this.timer);
    document.body.style.overflow = '';
    (this.lastFocus as HTMLElement | null)?.focus?.();
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    document.body.style.overflow = '';
  }
}
