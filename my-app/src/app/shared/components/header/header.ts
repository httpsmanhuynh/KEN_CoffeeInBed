import { Component, ElementRef, HostListener, Input } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { MAIN_NAV, NavItem } from '../../../core/nav-links';

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
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
    return this.member;
  }

  @Input() userName = 'Khách hàng';
  logoutError = '';
  loggingOut = false;

  constructor(
    private host: ElementRef<HTMLElement>,
    private router: Router,
    private auth: AuthService,
  ) {}

  /** Mục nav đang xem (gạch chân như Figma). */
  isActive(item: NavItem): boolean {
    const url = this.router.url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
    const paths = item.match ?? (item.path ? [item.path] : []);
    return paths.includes(url);
  }

  // Chuột: hover mở/đóng. Cảm ứng: bỏ qua hover, chỉ dùng click (tránh mở rồi đóng ngay).
  enter(e: PointerEvent, key: string): void { if (e.pointerType === 'mouse') this.open = key; }
  leave(e: PointerEvent, key: string): void { if (e.pointerType === 'mouse' && this.open === key) this.open = null; }
  toggle(key: string): void { this.open = this.open === key ? null : key; }
  onNavClick(item: NavItem): void {
    this.closeAll();
  }
  closeAll(): void { this.open = null; this.mobileOpen = false; this.accountOpen = false; }

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
