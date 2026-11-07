import { Component, ElementRef, HostListener, OnDestroy, ViewChild, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SuggestionPopupService } from '../../services/suggestion-popup.service';

interface Slide { id: string; name: string; price: string; desc: string; image: string; }

const SLIDE_MS = 7000;   // Figma: tự chuyển 7 giây mỗi món
const TICK_MS = 50;
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

@Component({
  selector: 'app-suggestion-popup',
  standalone: false,
  templateUrl: './suggestion-popup.html',
  styleUrl: './suggestion-popup.css',
})
export class SuggestionPopup implements OnDestroy {
  protected readonly popup = inject(SuggestionPopupService);
  private readonly router = inject(Router);

  @ViewChild('dialog') dialog?: ElementRef<HTMLElement>;

  // TODO: lấy từ API gợi ý theo khung giờ. Nội dung theo Figma 632:10877 và 632:11325.
  readonly slides: Slide[] = [
    { id: 'matcha', name: 'Matcha Latte / Hojicha Latte', price: '55.000đ', image: '/images/figma/popup-matcha.png',
      desc: 'Một chút trà thơm quyện cùng sữa dịu nhẹ. Vừa hay cho lúc bạn muốn chậm lại giữa buổi chiều.' },
    { id: 'bacxiu', name: 'Bạc Xỉu / Salted Caramel Coffee', price: '45.000đ', image: '/images/figma/popup-bac-xiu.png',
      desc: 'Cà phê quyện sữa, ngọt dịu vừa đủ. Một lựa chọn để nhâm nhi cùng câu chuyện còn đang dang dở.' },
  ];

  index = 0;
  progress = 0;          // 0..1 của slide hiện tại
  paused = false;
  private timer?: ReturnType<typeof setInterval>;
  private lastFocus: Element | null = null;
  private wasOpen = false;

  constructor() {
    effect(() => {
      const open = this.popup.isOpen();
      if (open && !this.wasOpen) this.onOpen();
      else if (!open && this.wasOpen) this.onClose();
      this.wasOpen = open;
    });
  }

  /** Mảng 1 phần tử để @for dựng lại (và chạy animation) mỗi khi đổi món. */
  current: Slide[] = [this.slides[0]];
  get counter(): string { return `${String(this.index + 1).padStart(2, '0')} / ${String(this.slides.length).padStart(2, '0')} · Gợi ý buổi chiều`; }

  /** Độ rộng (%) phần đã chạy của thanh tiến trình thứ i. */
  fill(i: number): number {
    if (i < this.index) return 100;
    if (i === this.index) return Math.round(this.progress * 100);
    return 0;
  }

  next(): void { this.go((this.index + 1) % this.slides.length); }
  prev(): void { this.go((this.index - 1 + this.slides.length) % this.slides.length); }
  private go(i: number): void { this.index = i; this.progress = 0; this.current = [this.slides[i]]; }

  close(): void { this.popup.markSeen(); this.popup.hide(); }
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
    this.go(0); this.paused = false;
    this.lastFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      this.timer = setInterval(() => {
        if (this.paused) return;
        this.progress += TICK_MS / SLIDE_MS;
        if (this.progress >= 1) this.next();
      }, TICK_MS);
    }
    setTimeout(() => this.dialog?.nativeElement.focus());
  }

  private onClose(): void {
    clearInterval(this.timer);
    document.body.style.overflow = '';
    (this.lastFocus as HTMLElement | null)?.focus?.();
  }

  ngOnDestroy(): void { clearInterval(this.timer); document.body.style.overflow = ''; }
}
