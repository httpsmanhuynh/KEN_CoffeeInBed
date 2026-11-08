import { Location } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { isGuestPath } from './core/nav-links';

@Component({
  selector: 'app-root',
  standalone: false,
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  protected readonly title = signal('my-app');
  protected readonly member = signal(!isGuestPath(this.location.path()));

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.member.set(!isGuestPath(e.urlAfterRedirects)));
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
