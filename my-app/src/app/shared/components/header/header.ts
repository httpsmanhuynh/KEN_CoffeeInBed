import { Component, ElementRef, HostListener, Input } from '@angular/core';
import { MAIN_NAV } from '../../../core/nav-links';

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
  // TODO: lấy từ AuthService khi có API hồ sơ
  @Input() userName = 'Thầy Thanh đẹp trai';

  constructor(private host: ElementRef<HTMLElement>) {}

  // Chuột: hover mở/đóng. Cảm ứng: bỏ qua hover, chỉ dùng click (tránh mở rồi đóng ngay).
  enter(e: PointerEvent, key: string): void { if (e.pointerType === 'mouse') this.open = key; }
  leave(e: PointerEvent, key: string): void { if (e.pointerType === 'mouse' && this.open === key) this.open = null; }
  toggle(key: string): void { this.open = this.open === key ? null : key; }
  closeAll(): void { this.open = null; this.mobileOpen = false; this.accountOpen = false; }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event): void {
    if (!this.host.nativeElement.contains(e.target as Node)) this.closeAll();
  }
  @HostListener('document:keydown.escape')
  onEsc(): void { this.closeAll(); }
}
