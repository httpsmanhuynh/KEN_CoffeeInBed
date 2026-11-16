import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './core/auth.service';
import { SmoothScrollService } from './core/smooth-scroll.service';

@Component({
  selector: 'app-root',
  standalone: false,
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly smoothScroll = inject(SmoothScrollService);

  protected readonly title = signal('my-app');
  protected readonly fontScaleLevel = signal<0 | 1 | 2>(0);
  private readonly fontScales = ['100%', '105%', '110%'] as const;

  get isAdminRoute(): boolean {
    return this.router.url.startsWith('/admin');
  }

  get fontScaleLabel(): string {
    return this.fontScales[this.fontScaleLevel()];
  }

  constructor() {
    this.auth.loadSession().subscribe({
      error: error => console.error('Không thể kiểm tra phiên đăng nhập.', error),
    });
  }

  ngOnInit(): void {
    this.smoothScroll.init();
  }

  ngOnDestroy(): void {
    this.smoothScroll.destroy();
    if (typeof document !== 'undefined') {
      document.documentElement.style.fontSize = '';
    }
  }

  cycleFontScale(event?: Event): void {
    const nextLevel = ((this.fontScaleLevel() + 1) % this.fontScales.length) as 0 | 1 | 2;
    this.fontScaleLevel.set(nextLevel);
    if (typeof document !== 'undefined') {
      document.documentElement.style.fontSize = nextLevel === 0 ? '' : this.fontScales[nextLevel];
    }
    this.animateAArrowUp(event);
  }

  animateAArrowUp(event?: Event): void {
    const target = event?.currentTarget instanceof Element ? event.currentTarget : null;
    this.smoothScroll.animateLucideAArrowUp(target);
  }

  @HostListener('document:click', ['$event'])
  handleKenFragmentClick(event: MouseEvent): void {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const clicked = event.target;
    if (!(clicked instanceof Element)) {
      return;
    }

    const anchor = clicked.closest('a[href^="#"]') as HTMLAnchorElement | null;
    if (!anchor) {
      return;
    }

    const href = anchor.getAttribute('href');
    if (!href || href === '#') {
      event.preventDefault();
      return;
    }

    let targetId = href.substring(1);
    try {
      targetId = decodeURIComponent(targetId);
    } catch {
      // Keep original fragment if encoding is invalid.
    }

    const target = document.getElementById(targetId);
    if (!target) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    const header = document.querySelector('app-header') as HTMLElement | null;
    const headerHeight = header ? header.getBoundingClientRect().height : 0;

    this.smoothScroll.scrollTo(target, {
      offset: -(headerHeight + 16),
      duration: 1.1,
    });
  }
}
