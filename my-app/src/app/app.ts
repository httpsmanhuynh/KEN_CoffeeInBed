import { Location } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
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

  /**
   * true = header đã đăng nhập (avatar + tên) cho mọi trang trừ nhóm auth.
   * Khởi tạo từ URL trình duyệt (không phải router.url, vốn là "/" trước khi điều hướng xong)
   * để không bị nháy header khách khi tải thẳng một trang như /security.
   */
  protected readonly member = signal(!isGuestPath(this.location.path()));

  /**
   * true khi đang ở các trang quản trị admin (/admin, /admin/dashboard, /admin/bookings...)
   * Khi đó sẽ ẩn header & footer khách của customer để hiển thị layout riêng của admin.
   */
  protected readonly isAdmin = signal(this.location.path().startsWith('/admin'));

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.member.set(!isGuestPath(e.urlAfterRedirects));
        this.isAdmin.set(e.urlAfterRedirects.startsWith('/admin'));
      });
  }
}
