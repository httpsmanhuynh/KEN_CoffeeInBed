import { Component, HostListener, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: false,
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly title = signal('my-app');

  get isAdminRoute(): boolean {
    return this.router.url.startsWith('/admin');
  }

  constructor() {
    this.auth.loadSession().subscribe({
      error: error => console.error('Không thể kiểm tra phiên đăng nhập.', error),
    });
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
    const targetTop =
      target.getBoundingClientRect().top + window.scrollY - headerHeight - 16;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: 'smooth',
    });
  }
}
