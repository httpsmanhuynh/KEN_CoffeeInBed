import { Component, signal, HostListener } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: false,
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {

  // KEN_GLOBAL_FRAGMENT_SCROLL_V1
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

    const anchor = clicked.closest(
      'a[href^="#"]'
    ) as HTMLAnchorElement | null;

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

    // Khong de browser quay ve trang chu
    // khi khong tim thay ID tren trang hien tai.
    if (!target) {
      event.preventDefault();
      console.warn(
        '[KEN] Khong tim thay vi tri:',
        targetId,
        'tai',
        window.location.pathname
      );
      return;
    }

    event.preventDefault();

    const header = document.querySelector(
      'app-header'
    ) as HTMLElement | null;

    const headerHeight = header
      ? header.getBoundingClientRect().height
      : 0;

    const targetTop =
      target.getBoundingClientRect().top +
      window.scrollY -
      headerHeight -
      16;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: 'smooth'
    });
  }

  protected readonly title = signal('my-app');
}
