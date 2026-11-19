import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  NgZone,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import gsap from 'gsap';

@Component({
  selector: 'app-ken-intro',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ken-intro.html',
  styleUrl: './ken-intro.css',
})
export class KenIntroComponent implements AfterViewInit, OnDestroy {
  @ViewChild('introRoot', { static: true }) private introRoot!: ElementRef<HTMLElement>;
  @Output() readonly done = new EventEmitter<void>();

  private readonly ngZone = inject(NgZone);
  private gsapCtx: gsap.Context | null = null;
  private finished = false;

  ngAfterViewInit(): void {
    if (typeof window === 'undefined' || 'vitest' in globalThis) {
      this.finish();
      return;
    }

    const prefersReduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      this.finish();
      return;
    }

    document.body.style.overflow = 'hidden';

    this.ngZone.runOutsideAngular(() => {
      this.gsapCtx = gsap.context(() => {
        const tl = gsap.timeline({
          defaults: { ease: 'power3.out' },
          onComplete: () => this.finish(),
        });

        tl.fromTo(
          '.ki-nest',
          { scale: 0.84, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.9, ease: 'power3.out' },
        )
          .fromTo(
            '.ki-ring',
            { strokeDashoffset: 440, opacity: 0.15 },
            { strokeDashoffset: 0, opacity: 0.92, duration: 1.45, stagger: 0.16, ease: 'power2.inOut' },
            '-=0.65',
          )
          .fromTo(
            '.ki-wordmark',
            { opacity: 0, letterSpacing: '0.38em', filter: 'blur(6px)' },
            { opacity: 1, letterSpacing: '0.22em', filter: 'blur(0px)', duration: 1.05, ease: 'power3.out' },
            '-=1.2',
          )
          .fromTo(
            '.ki-caption',
            { y: 14, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.65 },
            '-=0.85',
          )
          .to('.ki-progress-fill', { scaleX: 1, duration: 2.15, ease: 'power1.inOut' }, 0.2)
          .to('.ki-seam', { scaleY: 1, opacity: 1, duration: 0.45, ease: 'power2.out' }, '-=0.15')
          .to('.ki-center', { scale: 1.08, opacity: 0, duration: 0.5, ease: 'power2.in' }, '-=0.2')
          .to(
            '.ki-shell-left',
            {
              xPercent: -108,
              borderTopRightRadius: '50% 42%',
              borderBottomRightRadius: '50% 42%',
              duration: 1.1,
              ease: 'power4.inOut',
            },
            '-=0.22',
          )
          .to(
            '.ki-shell-right',
            {
              xPercent: 108,
              borderTopLeftRadius: '50% 42%',
              borderBottomLeftRadius: '50% 42%',
              duration: 1.1,
              ease: 'power4.inOut',
            },
            '<',
          )
          .to('.ki-seam', { opacity: 0, duration: 0.4 }, '<0.12');
      }, this.introRoot.nativeElement);
    });
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    this.gsapCtx?.revert();
    this.gsapCtx = null;
  }

  skip(): void {
    this.finish();
  }

  private finish(): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    document.body.style.overflow = '';
    this.gsapCtx?.revert();
    this.gsapCtx = null;
    this.ngZone.run(() => this.done.emit());
  }
}
