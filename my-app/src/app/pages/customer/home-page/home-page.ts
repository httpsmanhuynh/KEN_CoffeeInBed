import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CustomerApiService } from '../../../core/customer-api.service';

interface HomeHeroSlide {
  image: string;
  caption: string;
  tag: string;
}

interface HomeJourney {
  index: string;
  label: string;
  title: string;
  description: string;
  image: string;
  mascot: string;
  zone: 'connect' | 'focus' | 'rest';
}

interface HomeSpaceCard {
  index: string;
  privacy: string;
  name: string;
  priceTag: string;
  description: string;
  perks: string[];
  image: string;
  detailRoute: string;
  bookingRoute: string | null;
}

interface HomeStep {
  num: string;
  title: string;
  description: string;
  highlight: string;
}

interface HomeMenuHighlight {
  name: string;
  price: string;
  tag: string;
  image: string;
}

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
})
export class HomePage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('homeRoot', { static: true }) private homeRoot!: ElementRef<HTMLElement>;

  private readonly ngZone = inject(NgZone);
  private readonly api = inject(CustomerApiService, { optional: true });
  private gsapCtx: gsap.Context | null = null;
  private heroTimer: ReturnType<typeof setInterval> | null = null;
  private cleanups: Array<() => void> = [];

  readonly activeHero = signal(0);
  readonly activeSpaceIndex = signal(0);
  readonly activeStepIndex = signal(0);

  readonly heroSlides: HomeHeroSlide[] = [
    {
      image: '/images/ken-home/hero-1.png',
      caption: 'KÉN Tập Trung · Ánh sáng dịu & yên tĩnh tuyệt đối',
      tag: '01 · FOCUS',
    },
    {
      image: '/images/ken-home/hero-2.png',
      caption: 'KÉN Tái Tạo · Ngả lưng giữa nhịp sống phố thị',
      tag: '02 · REST',
    },
    {
      image: '/images/ken-home/hero-3.png',
      caption: 'KÉN Kết Nối · Cà phê thủ công & những cuộc trò chuyện ấm áp',
      tag: '03 · CONNECT',
    },
  ];

  readonly manifestoWords: string[] = [
    'Không',
    'chỉ',
    'là',
    'một',
    'quán',
    'cà',
    'phê.',
    'KÉN',
    'là',
    'khoảng',
    'lặng',
    'được',
    'thiết',
    'kế',
    'để',
    'bạn',
    'tập',
    'trung',
    'sâu,',
    'ngả',
    'lưng',
    'tái',
    'tạo,',
    'và',
    'kết',
    'nối',
    'theo',
    'nhịp',
    'riêng',
    'của',
    'mình.',
  ];

  readonly stats = signal<
    Array<{ value: number; suffix: string; label: string; decimals?: number }>
  >([
    { value: 3, suffix: '', label: 'Kết Nối · Tập Trung · Tái Tạo' },
    { value: 15, suffix: ' phút', label: 'Giữ chỗ tự động khi đặt' },
    { value: 30, suffix: 'K', label: 'Khởi điểm mỗi giờ làm việc' },
    { value: 4.3, suffix: '/5 ★', label: '3.044 đánh giá từ khách trải nghiệm', decimals: 1 },
  ]);

  readonly journeys: HomeJourney[] = [
    {
      index: '01',
      label: 'KÉN KẾT NỐI',
      title: 'Trò chuyện & tận hưởng',
      description:
        'Không gian mở ấm áp với hương cà phê rang mới và bánh ngọt thủ công. Ghé bất cứ lúc nào mà không cần đặt trước.',
      image: '/images/ken-journeys/connect.jpg',
      mascot: '/images/ken-home/mascot-connect.png',
      zone: 'connect',
    },
    {
      index: '02',
      label: 'KÉN TẬP TRUNG',
      title: 'Hoàn thành điều dang dở',
      description:
        'Ánh sáng chuẩn học tập, Wi-Fi tốc độ cao, ổ cắm từng vị trí và phòng họp riêng biệt không tiếng ồn.',
      image: '/images/ken-journeys/focus.jpg',
      mascot: '/images/ken-home/mascot-focus.png',
      zone: 'focus',
    },
    {
      index: '03',
      label: 'KÉN TÁI TẠO',
      title: 'Ngủ ngắn để bứt phá',
      description:
        'Cabin giường nằm có rèm che kín đáo, chăn ấm và không gian yên tĩnh giúp cơ thể nạp lại năng lượng giữa ngày.',
      image: '/images/ken-journeys/rest.jpg',
      mascot: '/images/ken-home/mascot-rest.png',
      zone: 'rest',
    },
  ];

  readonly spaces: HomeSpaceCard[] = [
    {
      index: '01',
      privacy: 'CỞI MỞ NHẤT',
      name: 'KÉN Café',
      priceTag: 'Ghé trực tiếp · Không cần đặt trước',
      description:
        'Góc cà phê ấm cúng cho buổi hẹn bạn bè, đọc sách hay làm việc nhẹ nhàng không giới hạn thời gian.',
      perks: ['Cà phê & bánh thủ công', 'Ánh sáng tự nhiên', 'Nhạc acoustic dịu nhẹ'],
      image: '/images/ken-home/privacy-cafe.png',
      detailRoute: '/spaces/connect',
      bookingRoute: null,
    },
    {
      index: '02',
      privacy: 'KHÁ RIÊNG TƯ',
      name: 'Khu làm việc chung',
      priceTag: '30.000đ / người · giờ',
      description:
        'Bàn dài rộng rãi, ổ cắm từng chỗ và không gian yên tĩnh dành riêng cho những phiên deep-work hiệu quả.',
      perks: ['Wi-Fi tốc độ cao', 'Tặng nước từ 2 giờ', 'Gói 4h kèm 01 đồ uống'],
      image: '/images/ken-home/privacy-work.png',
      detailRoute: '/spaces/work-lounge',
      bookingRoute: '/booking/work',
    },
    {
      index: '03',
      privacy: 'RIÊNG TƯ',
      name: 'Phòng họp nhỏ',
      priceTag: '250.000đ / gói 3 giờ · 3–6 khách',
      description:
        'Không gian khép kín cho học nhóm, brainstorm dự án hoặc họp online chuyên nghiệp với đầy đủ thiết bị.',
      perks: ['Máy chiếu & bảng từ', 'Cách âm riêng biệt', 'Nước suối cho từng khách'],
      image: '/images/ken-home/privacy-meeting.png',
      detailRoute: '/spaces/small-meeting-room',
      bookingRoute: '/booking/meeting-small',
    },
    {
      index: '04',
      privacy: 'RIÊNG TƯ CAO',
      name: 'KÉN nghỉ đơn',
      priceTag: '70.000đ / gói 1 giờ · 1 khách',
      description:
        'Chiếc kén riêng tư với giường đơn êm ái, rèm che chắn sáng và ổ cắm sạc để bạn chợp mắt sâu giữa ngày.',
      perks: ['Rèm che kín đáo', '15 phút dọn sạch sau lượt', 'Gói 2h kèm 01 đồ uống'],
      image: '/images/ken-home/privacy-single.png',
      detailRoute: '/spaces/single',
      bookingRoute: '/booking/single',
    },
    {
      index: '05',
      privacy: 'RIÊNG TƯ NHẤT',
      name: 'KÉN nghỉ đôi',
      priceTag: '100.000đ / gói 1 giờ · 1–2 khách',
      description:
        'Khoảng nghỉ rộng rãi cho hai người, tách biệt hoàn toàn khỏi nhịp phố ồn ào để nạp lại tinh thần.',
      perks: ['Giường đôi rộng rãi', 'Yên tĩnh tuyệt đối', 'Gói 2h: 180.000đ / KÉN'],
      image: '/images/ken-home/privacy-double.png',
      detailRoute: '/spaces/double',
      bookingRoute: '/booking/double',
    },
  ];

  readonly marqueeTop: string[] = [
    '/images/ken-home/moments-1.png',
    '/images/ken-home/moments-2.png',
    '/images/ken-home/moments-3.png',
    '/images/ken-home/moments-4.png',
    '/images/ken-home/cafe-1.png',
    '/images/ken-home/cafe-2.png',
  ];

  readonly marqueeBottom: string[] = [
    '/images/ken-home/moments-5.png',
    '/images/ken-home/moments-6.png',
    '/images/ken-home/moments-7.png',
    '/images/ken-home/moments-8.png',
    '/images/ken-home/cafe-3.png',
    '/images/ken-home/cafe-4.png',
  ];

  readonly bookingSteps: HomeStep[] = [
    {
      num: '01',
      title: 'Chọn phân khu & không gian',
      description:
        'Duyệt 5 mức độ riêng tư từ KÉN Café, Khu làm việc chung, Phòng họp nhỏ đến KÉN nghỉ đơn và KÉN nghỉ đôi.',
      highlight: 'Kiểm tra chỗ trống theo thời gian thực',
    },
    {
      num: '02',
      title: 'Chọn gói & khung giờ linh hoạt',
      description:
        'Đặt theo giờ hoặc gói cố định nửa ngày. Hệ thống tự tính buffer 15 phút dọn dẹp giữa các lượt.',
      highlight: 'Giá niêm yết minh bạch, không phát sinh',
    },
    {
      num: '03',
      title: 'Cá nhân hóa đồ uống & tiện ích',
      description:
        'Chọn quyền lợi đi kèm gói (Inclusion) và mua thêm cà phê, bánh ngọt, màn hình 24” hoặc bàn phím & chuột.',
      highlight: 'Gợi ý món thông minh từ hệ thống KÉN',
    },
    {
      num: '04',
      title: 'Giữ chỗ 15 phút & thanh toán',
      description:
        'Áp dụng Voucher & ưu đãi hạng thành viên (lên tới 15%), thanh toán nhanh và nhận mã Check-in.',
      highlight: 'Tích lũy KÉN Điểm & KÉN Coins tự động',
    },
  ];

  readonly signatureMenu: HomeMenuHighlight[] = [
    {
      name: 'Cà phê Đen / Sữa',
      price: '40.000đ',
      tag: 'Cà phê & trà',
      image: '/images/addons/cf-sua.png',
    },
    {
      name: 'Matcha Latte',
      price: '55.000đ',
      tag: 'Best Seller',
      image: '/images/addons/matcha-latte.png',
    },
    {
      name: 'Hojicha Latte',
      price: '55.000đ',
      tag: 'Cà phê & trà',
      image: '/images/addons/hojicha-latte.png',
    },
    {
      name: 'Bánh sừng bò (Croissant)',
      price: '35.000đ',
      tag: 'Bánh & ăn nhẹ',
      image: '/images/addons/bake-croissant.png',
    },
    {
      name: 'Màn hình 24”',
      price: '50.000đ',
      tag: 'Tiện ích làm việc',
      image: '/images/addons/eq-monitor.png',
    },
    {
      name: 'Bàn phím & chuột',
      price: '30.000đ',
      tag: 'Tiện ích làm việc',
      image: '/images/addons/eq-keyboard-mouse.png',
    },
  ];

  ngOnInit(): void {
    this.api?.getReviews({ limit: '1', skip: '0' }).subscribe({
      next: (res) => {
        const avg = Number(res?.averageRating ?? 0);
        const total = Number(res?.totalReviews ?? 0);
        if (avg > 0 && total > 0) {
          const formattedTotal = total.toLocaleString('vi-VN');
          this.stats.update((list) =>
            list.map((item, idx) =>
              idx === 3
                ? {
                    ...item,
                    value: Number(avg.toFixed(1)),
                    label: `${formattedTotal} đánh giá từ khách trải nghiệm`,
                  }
                : item,
            ),
          );
        }
      },
      error: () => {},
    });
  }

  ngAfterViewInit(): void {
    if (typeof window === 'undefined' || 'vitest' in globalThis) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      gsap.registerPlugin(ScrollTrigger);

      const prefersReduced =
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.initHeroAutoplay();

      if (prefersReduced) {
        return;
      }

      const root = this.homeRoot.nativeElement;

      this.gsapCtx = gsap.context(() => {
        this.animateHeroEntrance(0);
        this.animateHeroParallax();
        this.animateManifestoScrub();
        this.animateCounters();
        this.animateJourneyCards();
        this.animateHorizontalSpaces();
        this.animateStickySteps();
        this.animateRevealSections();
      }, root);

      this.bindMagneticButtons(root);
      this.bindSpotlightCards(root);

      requestAnimationFrame(() => ScrollTrigger.refresh());
    });
  }

  ngOnDestroy(): void {
    if (this.heroTimer) {
      clearInterval(this.heroTimer);
      this.heroTimer = null;
    }
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    this.gsapCtx?.revert();
    this.gsapCtx = null;
  }

  selectHero(index: number): void {
    this.activeHero.set(index);
    this.restartHeroAutoplay();
  }

  scrollToSection(id: string): void {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private initHeroAutoplay(): void {
    this.heroTimer = setInterval(() => {
      this.ngZone.run(() => {
        this.activeHero.update((idx) => (idx + 1) % this.heroSlides.length);
      });
    }, 5500);
  }

  private restartHeroAutoplay(): void {
    if (this.heroTimer) {
      clearInterval(this.heroTimer);
    }
    this.initHeroAutoplay();
  }

  private animateHeroEntrance(delay = 0): void {
    const tl = gsap.timeline({ delay, defaults: { ease: 'power4.out' } });

    tl.fromTo(
      '.hp-hero-frame',
      { clipPath: 'inset(5% 4% 5% 4% round 28px)', scale: 1.04 },
      { clipPath: 'inset(0% 0% 0% 0% round 0px)', scale: 1, duration: 1.1 },
    )
      .fromTo(
        '.hp-hero-eyebrow',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.65 },
        '-=0.7',
      )
      .fromTo(
        '.hp-split-line-inner',
        { yPercent: 110, rotate: 1.4 },
        { yPercent: 0, rotate: 0, duration: 0.9, stagger: 0.12 },
        '-=0.5',
      )
      .fromTo(
        '.hp-hero-sub, .hp-hero-actions, .hp-hero-bottom',
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, stagger: 0.1 },
        '-=0.45',
      );
  }

  private animateHeroParallax(): void {
    gsap.to('.hp-hero-media', {
      yPercent: 18,
      scale: 1.12,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hp-hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    });

    gsap.to('.hp-hero-content', {
      yPercent: -12,
      opacity: 0.2,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hp-hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    });
  }

  private animateManifestoScrub(): void {
    gsap.fromTo(
      '.hp-manifesto-word',
      { opacity: 0.16, y: 8 },
      {
        opacity: 1,
        y: 0,
        stagger: 0.04,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hp-manifesto',
          start: 'top 78%',
          end: 'bottom 58%',
          scrub: 0.7,
        },
      },
    );
  }

  private animateCounters(): void {
    const root = this.homeRoot.nativeElement;
    const nodes = root.querySelectorAll<HTMLElement>('.hp-stat-value');

    nodes.forEach((node) => {
      const target = Number(node.dataset['target'] ?? '0');
      const decimals = Number(node.dataset['decimals'] ?? '0');
      const suffix = node.dataset['suffix'] ?? '';
      const counter = { val: 0 };

      gsap.to(counter, {
        val: target,
        duration: 1.4,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: node,
          start: 'top 88%',
          once: true,
        },
        onUpdate: () => {
          const formatted =
            decimals > 0 ? counter.val.toFixed(decimals) : Math.round(counter.val).toString();
          node.textContent = `${formatted}${suffix}`;
        },
      });
    });
  }

  private animateJourneyCards(): void {
    gsap.fromTo(
      '.hp-journey-card',
      { y: 48, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.85,
        stagger: 0.16,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.hp-journeys-grid',
          start: 'top 80%',
          once: true,
        },
      },
    );

    gsap.utils.toArray<HTMLElement>('.hp-journey-photo img:first-child').forEach((img) => {
      gsap.fromTo(
        img,
        { scale: 1.16, yPercent: -6 },
        {
          scale: 1.04,
          yPercent: 6,
          ease: 'none',
          scrollTrigger: {
            trigger: img,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        },
      );
    });
  }

  private animateHorizontalSpaces(): void {
    const mm = gsap.matchMedia();

    mm.add('(min-width: 960px)', () => {
      const root = this.homeRoot.nativeElement;
      const section = root.querySelector<HTMLElement>('.hp-spaces-pin');
      const track = root.querySelector<HTMLElement>('.hp-spaces-track');
      const progressFill = root.querySelector<HTMLElement>('.hp-spaces-progress-fill');

      if (!section || !track) {
        return;
      }

      const getDistance = () => Math.max(0, track.scrollWidth - window.innerWidth + 120);

      gsap.to(track, {
        x: () => -getDistance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => `+=${Math.max(getDistance(), 900)}`,
          pin: true,
          scrub: 0.85,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (progressFill) {
              progressFill.style.transform = `scaleX(${Math.max(0.06, self.progress)})`;
            }
            const nextIdx = Math.min(
              this.spaces.length - 1,
              Math.floor(self.progress * this.spaces.length),
            );
            if (nextIdx !== this.activeSpaceIndex()) {
              this.ngZone.run(() => this.activeSpaceIndex.set(nextIdx));
            }
          },
        },
      });
    });
  }

  private animateStickySteps(): void {
    const root = this.homeRoot.nativeElement;
    const stepCards = root.querySelectorAll<HTMLElement>('.hp-step-card');

    stepCards.forEach((card, index) => {
      ScrollTrigger.create({
        trigger: card,
        start: 'top 62%',
        end: 'bottom 42%',
        onEnter: () => this.ngZone.run(() => this.activeStepIndex.set(index)),
        onEnterBack: () => this.ngZone.run(() => this.activeStepIndex.set(index)),
      });
    });
  }

  private animateRevealSections(): void {
    gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
      gsap.fromTo(
        el,
        { y: 36, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.85,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 84%',
            once: true,
          },
        },
      );
    });
  }

  private bindMagneticButtons(root: HTMLElement): void {
    const buttons = root.querySelectorAll<HTMLElement>('[data-magnetic]');

    buttons.forEach((btn) => {
      const moveX = gsap.quickTo(btn, 'x', { duration: 0.35, ease: 'power3.out' });
      const moveY = gsap.quickTo(btn, 'y', { duration: 0.35, ease: 'power3.out' });

      const onMove = (event: MouseEvent) => {
        const rect = btn.getBoundingClientRect();
        const relX = event.clientX - rect.left - rect.width / 2;
        const relY = event.clientY - rect.top - rect.height / 2;
        moveX(relX * 0.24);
        moveY(relY * 0.24);
      };

      const onLeave = () => {
        moveX(0);
        moveY(0);
      };

      btn.addEventListener('mousemove', onMove);
      btn.addEventListener('mouseleave', onLeave);
      this.cleanups.push(() => {
        btn.removeEventListener('mousemove', onMove);
        btn.removeEventListener('mouseleave', onLeave);
      });
    });
  }

  private bindSpotlightCards(root: HTMLElement): void {
    const cards = root.querySelectorAll<HTMLElement>('[data-spotlight]');

    cards.forEach((card) => {
      const onMove = (event: MouseEvent) => {
        const rect = card.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        card.style.setProperty('--spot-x', `${x}px`);
        card.style.setProperty('--spot-y', `${y}px`);
      };

      card.addEventListener('mousemove', onMove);
      this.cleanups.push(() => card.removeEventListener('mousemove', onMove));
    });
  }
}
