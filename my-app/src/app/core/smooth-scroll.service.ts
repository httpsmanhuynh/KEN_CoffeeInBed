import { Injectable, NgZone, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

@Injectable({ providedIn: 'root' })
export class SmoothScrollService {
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  private lenis: Lenis | null = null;
  private tickerCallback: ((time: number) => void) | null = null;
  private routerSub: Subscription | null = null;
  private pageTriggers: ScrollTrigger[] = [];
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private rafId: number | null = null;
  private initialized = false;
  private readonly spotlightWired = new WeakSet<HTMLElement>();
  private anchorClickHandler: ((event: MouseEvent) => void) | null = null;

  private get isUnsupportedEnv(): boolean {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return true;
    }
    if ('vitest' in globalThis) {
      return true;
    }
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
      return true;
    }
    return false;
  }

  private get prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  init(): void {
    if (this.initialized || this.isUnsupportedEnv) {
      return;
    }
    this.initialized = true;

    this.ngZone.runOutsideAngular(() => {
      gsap.registerPlugin(ScrollTrigger);

      this.lenis = new Lenis({
        autoRaf: false,
        anchors: false,
        allowNestedScroll: true,
        stopInertiaOnNavigate: false,
        lerp: 0.09,
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1,
        respectReducedMotion: true,
      });

      this.lenis.on('scroll', (e: Lenis) => {
        ScrollTrigger.update();
        this.updateScrollUi(e.scroll ?? window.scrollY, e.progress ?? 0);
      });

      this.tickerCallback = (time: number) => {
        this.lenis?.raf(time * 1000);
      };
      gsap.ticker.add(this.tickerCallback);
      gsap.ticker.lagSmoothing(0);

      this.updateScrollUi(window.scrollY || 0, 0);
      this.scheduleRouteRefresh();

      this.anchorClickHandler = (event: MouseEvent) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }
        const target = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
        if (!(target instanceof HTMLAnchorElement)) {
          return;
        }
        const hash = target.getAttribute('href') || '';
        if (hash.length <= 1) {
          return;
        }
        const el = document.getElementById(hash.slice(1));
        if (!el) {
          return;
        }
        event.preventDefault();
        this.scrollTo(el, { offset: -88, duration: 0.9 });
      };
      document.addEventListener('click', this.anchorClickHandler);

      this.routerSub = this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe((event) => {
          const hasFragment = event.urlAfterRedirects.includes('#');
          if (!hasFragment) {
            this.scrollTo(0, { immediate: true });
          }
          this.updateScrollUi(window.scrollY || 0, 0);
          this.scheduleRouteRefresh();
        });
    });
  }

  destroy(): void {
    if (!this.initialized) {
      return;
    }
    this.initialized = false;

    this.routerSub?.unsubscribe();
    this.routerSub = null;

    if (this.anchorClickHandler && typeof document !== 'undefined') {
      document.removeEventListener('click', this.anchorClickHandler);
      this.anchorClickHandler = null;
    }

    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.killPageTriggers();

    if (this.tickerCallback) {
      gsap.ticker.remove(this.tickerCallback);
      this.tickerCallback = null;
    }

    this.lenis?.destroy();
    this.lenis = null;
  }

  scrollTo(
    target: number | string | HTMLElement,
    options?: { offset?: number; duration?: number; immediate?: boolean },
  ): void {
    if (this.isUnsupportedEnv) {
      return;
    }

    if (this.lenis) {
      this.lenis.resize();
      this.lenis.scrollTo(target, {
        offset: options?.offset ?? 0,
        duration: options?.duration ?? 1.1,
        immediate: options?.immediate ?? false,
      });
      return;
    }

    let top = 0;
    if (typeof target === 'number') {
      top = target;
    } else if (typeof target === 'string') {
      const el = document.querySelector(target);
      if (el instanceof HTMLElement) {
        top = el.getBoundingClientRect().top + window.scrollY + (options?.offset ?? 0);
      }
    } else if (target instanceof HTMLElement) {
      top = target.getBoundingClientRect().top + window.scrollY + (options?.offset ?? 0);
    }

    window.scrollTo({
      top: Math.max(0, top),
      behavior: options?.immediate ? 'auto' : 'smooth',
    });
  }

  animateSpaceSwitch(containerSelector: string): void {
    if (this.isUnsupportedEnv || this.prefersReducedMotion) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        const container = document.querySelector(containerSelector);
        if (!(container instanceof HTMLElement)) {
          return;
        }
        const targets = container.querySelectorAll('.kh-space-collage img, .kh-space-detail-copy > *');
        const animTargets = targets.length > 0 ? targets : container;
        gsap.fromTo(
          animTargets,
          { y: 14, opacity: 0.25 },
          {
            y: 0,
            opacity: 1,
            duration: 0.45,
            stagger: 0.035,
            ease: 'power2.out',
            overwrite: true,
            clearProps: 'transform,opacity',
          },
        );
      });
    });
  }

  animateSlideTransition(selector = '.kh-hero-image--active'): void {
    if (this.isUnsupportedEnv || this.prefersReducedMotion) {
      return;
    }
    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        const active = document.querySelector(selector);
        if (active instanceof HTMLElement) {
          gsap.fromTo(
            active,
            { scale: 1.045 },
            { scale: 1, duration: 1.4, ease: 'power2.out', overwrite: true, clearProps: 'transform' },
          );
        }
      });
    });
  }

  private updateScrollUi(scroll: number, progress: number): void {
    const docEl = document.documentElement;
    const clampedProgress = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
    docEl.style.setProperty('--ken-scroll-progress', String(clampedProgress));

    const header = document.querySelector('app-header .hd');
    if (header instanceof HTMLElement) {
      header.classList.toggle('is-scrolled', scroll > 24);
    }
  }

  private scheduleRouteRefresh(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
    }
    if (this.rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId);
    }

    this.rafId = requestAnimationFrame(() => {
      this.refreshTimer = setTimeout(() => {
        this.lenis?.resize();
        this.animateCurrentPage();
        ScrollTrigger.refresh();
      }, 60);
    });
  }

  private killPageTriggers(): void {
    for (const trigger of this.pageTriggers) {
      trigger.kill();
    }
    this.pageTriggers = [];
  }

  private animateCurrentPage(): void {
    this.killPageTriggers();

    if (this.prefersReducedMotion || this.router.url.startsWith('/admin')) {
      return;
    }

    // 1. Hero Entrance Stagger
    const heroBodies = document.querySelectorAll(
      '.kh-hero-body, .ks-hero-intro, .about-hero-copy, .journeys-hero-copy, .kf-listing-hero-copy, .kf-menu-intro, .ken-hero',
    );
    heroBodies.forEach((body) => {
      if (!(body instanceof HTMLElement) || body.hasAttribute('data-ken-animated')) {
        return;
      }
      const children = Array.from(
        body.querySelectorAll(
          '.kh-hero-eyebrow, .ks-eyebrow, .about-eyebrow, .journeys-eyebrow, .kf-eyebrow-light, .ken-eyebrow, h1, .kh-hero-slogan, .about-script, .journeys-script, .kf-script, p, .kh-actions, .about-actions, .ks-hero-side, .kf-button-row, .ken-actions',
        ),
      ).filter((el): el is HTMLElement => el instanceof HTMLElement && !el.hasAttribute('data-ken-animated'));

      if (children.length > 0) {
        body.setAttribute('data-ken-animated', 'true');
        children.forEach((el) => el.setAttribute('data-ken-animated', 'true'));
        gsap.fromTo(
          children,
          { y: 26, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.09,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
          },
        );
      }
    });

    // 2. Hero Visual Images Entrance
    const heroImages = Array.from(
      document.querySelectorAll(
        '.ks-hero-visual img, .about-hero-picture img, .journeys-hero-image, .kf-menu-drink-card, .ken-hero-image, .kh-about-pictures img',
      ),
    ).filter((el): el is HTMLElement => el instanceof HTMLElement && !el.hasAttribute('data-ken-animated'));

    if (heroImages.length > 0) {
      heroImages.forEach((img) => img.setAttribute('data-ken-animated', 'true'));
      gsap.fromTo(
        heroImages,
        { scale: 1.04, opacity: 0, y: 18 },
        {
          scale: 1,
          opacity: 1,
          y: 0,
          duration: 0.95,
          stagger: 0.08,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
        },
      );
    }

    // 3. Section Headings Reveal
    const headings = Array.from(
      document.querySelectorAll(
        '.kh-center-intro, .kh-about-copy, .ks-section-heading, .ken-section-head, .journeys-heading, .kf-menu-title, .about-what, .ks-final-cta, .journeys-outro, .about-ending-panel',
      ),
    ).filter((el): el is HTMLElement => el instanceof HTMLElement && !el.hasAttribute('data-ken-animated'));

    for (const heading of headings) {
      heading.setAttribute('data-ken-animated', 'true');
      const rect = heading.getBoundingClientRect();
      if (rect.top <= window.innerHeight * 0.92) {
        gsap.fromTo(
          heading,
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.65, ease: 'power2.out', clearProps: 'transform,opacity' },
        );
      } else {
        const tween = gsap.fromTo(
          heading,
          { y: 28, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.75,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
            scrollTrigger: {
              trigger: heading,
              start: 'top 88%',
              once: true,
            },
          },
        );
        if (tween.scrollTrigger) {
          this.pageTriggers.push(tween.scrollTrigger);
        }
      }
    }

    // 4. Card & Grid Batch Staggered Reveal
    const cardSelector = [
      '.kh-advantage',
      '.kh-mascot-card',
      '.kh-step',
      '.kh-rail-option',
      '.kh-price-card',
      '.kh-addon',
      '.kh-branch-card',
      '.kh-gallery-mosaic img',
      '.kh-member-card',
      '.kh-day-grid > div',
      '.kh-faq-item',
      '.kh-contact-form',
      '.ks-zone',
      '.ks-space-card',
      '.about-stats > div',
      '.about-space-card',
      '.about-vision-row',
      '.about-values article',
      '.about-timeline-list article',
      '.journeys-card',
      '.kf-search-card',
      '.kf-listing-card',
      '.kf-product',
      '.kf-menu-about-inner > *',
      '.kf-menu-visit-inner > *',
      '.kf-zone-links > a',
      '.ken-card',
      '.ken-package',
      '.ken-policy-section',
      '.ken-timeline-row',
      '.ken-story-card',
    ].join(', ');

    const cards = Array.from(document.querySelectorAll(cardSelector)).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && !el.hasAttribute('data-ken-animated'),
    );

    const aboveFold: HTMLElement[] = [];
    const belowFold: HTMLElement[] = [];

    for (const card of cards) {
      card.setAttribute('data-ken-animated', 'true');
      const rect = card.getBoundingClientRect();
      if (rect.top > window.innerHeight * 0.92) {
        belowFold.push(card);
      } else {
        aboveFold.push(card);
      }
    }

    if (aboveFold.length > 0) {
      gsap.fromTo(
        aboveFold,
        { y: 18, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.65,
          stagger: 0.05,
          ease: 'power2.out',
          overwrite: true,
          clearProps: 'transform,opacity',
        },
      );
    }

    if (belowFold.length > 0) {
      gsap.set(belowFold, { y: 30, opacity: 0 });
      const batchTriggers = ScrollTrigger.batch(belowFold, {
        start: 'top 90%',
        once: true,
        onEnter: (batch) => {
          gsap.to(batch, {
            y: 0,
            opacity: 1,
            duration: 0.7,
            stagger: 0.07,
            ease: 'power3.out',
            overwrite: true,
            clearProps: 'transform,opacity',
          });
        },
      });
      this.pageTriggers.push(...batchTriggers);
    }

    // 5. React Bits-Style Spotlight & Interactive Card Glow
    this.attachCardSpotlight();
  }

  private attachCardSpotlight(): void {
    const spotlightSelector = [
      '.kh-advantage',
      '.kh-mascot-card',
      '.kh-price-card',
      '.ks-space-card',
      '.ks-zone',
      '.about-space-card',
      '.journeys-card',
      '.kf-listing-card',
      '.kf-product',
      '.ken-card',
    ].join(', ');

    const elements = document.querySelectorAll(spotlightSelector);
    elements.forEach((el) => {
      if (!(el instanceof HTMLElement)) {
        return;
      }
      el.setAttribute('data-ken-spotlight', 'true');
      if (this.spotlightWired.has(el)) {
        return;
      }
      this.spotlightWired.add(el);
      el.addEventListener(
        'pointermove',
        (event: PointerEvent) => {
          const rect = el.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100;
          const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * 100;
          el.style.setProperty('--spot-x', `${x.toFixed(1)}%`);
          el.style.setProperty('--spot-y', `${y.toFixed(1)}%`);
        },
        { passive: true },
      );
    });
  }
}
