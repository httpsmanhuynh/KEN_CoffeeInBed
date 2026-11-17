import { ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../../core/auth.service';
import { MAIN_NAV, NavItem } from '../../../core/nav-links';

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnInit {
  readonly nav = MAIN_NAV;
  /** Menu con đang mở (theo label). */
  open: string | null = null;
  mobileOpen = false;
  accountOpen = false;

  /** true = giao diện đã đăng nhập (avatar + tên thay cho nút Đăng nhập/Đăng ký). */
  @Input() member = false;

  @Input()
  set isLoggedIn(value: boolean) {
    this.member = value;
  }
  get isLoggedIn(): boolean {
    return this.isMember;
  }

  @Input() userName = 'Khách hàng';
  logoutError = '';
  loggingOut = false;
  showLogoutConfirm = false;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private closeTimer?: ReturnType<typeof setTimeout>;
  currentUrl = '';

  constructor(
    private host: ElementRef<HTMLElement>,
    private router: Router,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.currentUrl = this.normalizeUrl(this.router.url);
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        this.currentUrl = this.normalizeUrl(e.urlAfterRedirects || e.url);
        this.closeAll();
        this.cdr.markForCheck();
      });
    this.auth?.ensureSession?.().subscribe({ error: () => {} });
  }

  private normalizeUrl(raw: string): string {
    return (raw || '/').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  }

  get isMember(): boolean {
    return this.member || !!this.auth?.isAuthenticated;
  }

  get displayUserName(): string {
    return this.auth?.user?.fullName || this.userName || 'Khách hàng';
  }

  get displayAvatar(): string {
    return this.auth?.avatarUrl?.() || '/images/figma/nguoi-dung.svg';
  }

  /** Mục nav đang xem (gạch chân như Figma). */
  isActive(item: NavItem): boolean {
    const url = this.currentUrl || this.normalizeUrl(this.router.url);
    if (item.path === '/') {
      return url === '/' || url === '/home-logged-in';
    }
    if (item.path === '/spaces') {
      return url === '/spaces' || url.startsWith('/spaces/');
    }
    const paths = item.match ?? (item.path ? [item.path] : item.children?.map(c => c.path) ?? []);
    return paths.some(p => url === p || (p !== '/' && url.startsWith(p + '/')));
  }

  // Chuột: hover mở/đóng có vùng đệm + trễ đóng nhẹ để không tụt khi rê xuống menu con.
  enter(e: PointerEvent, key: string): void {
    if (e.pointerType !== 'mouse') return;
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = undefined;
    }
    this.open = key;
  }
  leave(e: PointerEvent, key: string): void {
    if (e.pointerType !== 'mouse' || this.open !== key) return;
    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => {
      if (this.open === key) {
        this.open = null;
        this.cdr.markForCheck();
      }
      this.closeTimer = undefined;
    }, 150);
  }
  toggle(key: string): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = undefined;
    }
    this.open = this.open === key ? null : key;
  }
  onNavClick(item: NavItem): void {
    this.closeAll();
  }
  closeAll(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = undefined;
    }
    this.open = null;
    this.mobileOpen = false;
    this.accountOpen = false;
  }

  requestLogout(): void {
    this.closeAll();
    this.showLogoutConfirm = true;
  }

  cancelLogout(): void {
    this.showLogoutConfirm = false;
  }

  confirmLogout(): void {
    this.showLogoutConfirm = false;
    this.logout();
  }

  logout(): void {
    if (this.loggingOut) return;
    this.loggingOut = true;
    this.logoutError = '';
    this.auth.logout().subscribe({
      next: () => {
        this.loggingOut = false;
        this.closeAll();
        this.router.navigateByUrl('/');
      },
      error: () => {
        this.loggingOut = false;
        this.logoutError = 'Không thể đăng xuất. Vui lòng thử lại.';
      },
    });
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event): void {
    if (!this.host.nativeElement.contains(e.target as Node)) this.closeAll();
  }
  @HostListener('document:keydown.escape')
  onEsc(): void { this.closeAll(); }
}

export { Header as HeaderComponent };
