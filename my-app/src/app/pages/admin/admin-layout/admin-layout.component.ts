import { Component, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../../core/auth.service';

export interface AdminNavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  exact?: boolean;
}

@Component({
  selector: 'app-admin-layout',
  standalone: false,
  styleUrl: './admin-layout.component.css',
  templateUrl: './admin-layout.component.html',
})
export class AdminLayoutComponent {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  currentUrl = this.router.url;
  isRefreshing = false;
  isUserMenuOpen = false;

  readonly navItems: AdminNavItem[] = [
    { id: 'nav-dashboard', label: 'Tổng quan', path: '/admin/dashboard', icon: '/images/figma/table.svg', exact: true },
    { id: 'nav-booking', label: 'Đặt chỗ', path: '/admin/bookings', icon: '/images/figma/lich-dat-cho.svg' },
    { id: 'nav-cust', label: 'Khách hàng', path: '/admin/customers', icon: '/images/ken-about/value-people.svg' },
    { id: 'nav-zone', label: 'Khu vực', path: '/admin/zones', icon: '/images/ken-home/icons/branch-pin.svg' },
    { id: 'nav-space', label: 'Không gian', path: '/admin/spaces', icon: '/images/ken-about/focus-icon.svg' },
    { id: 'nav-pkg', label: 'Gói dịch vụ', path: '/admin/packages', icon: '/images/figma/calendar-clock.svg' },
    { id: 'nav-addon', label: 'Sản phẩm & Add-on', path: '/admin/addons', icon: '/images/ken-flow/icons/listing-outlet.svg' },
    { id: 'nav-voucher', label: 'Voucher', path: '/admin/vouchers', icon: '/images/figma-gift.svg' },
    { id: 'nav-fore', label: 'Dự báo món', path: '/admin/forecast', icon: '/images/figma/table.svg' },
  ];

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.currentUrl = e.urlAfterRedirects;
      });
  }

  isItemActive(item: AdminNavItem): boolean {
    if (item.exact) {
      return this.currentUrl === item.path || this.currentUrl === '/admin';
    }
    return this.currentUrl.startsWith(item.path);
  }

  getCurrentPageTitle(): string {
    if (this.currentUrl.includes('/admin/bookings')) {
      return 'Quản lý Booking';
    }
    if (this.currentUrl.includes('/admin/customers')) {
      return 'Khách hàng & Thành viên';
    }
    if (this.currentUrl.includes('/admin/areas') || this.currentUrl.includes('/admin/zones')) {
      return this.currentUrl.includes('/new') || /\/areas\/[^/]+$/.test(this.currentUrl) ? 'Thêm khu vực' : 'Quản lý khu vực';
    }
    if (this.currentUrl.includes('/admin/spaces')) {
      if (this.currentUrl.includes('/new')) return 'Thêm không gian';
      if (this.currentUrl.includes('/edit')) return 'Chỉnh sửa không gian';
      return 'Quản lý không gian';
    }
    if (this.currentUrl.includes('/admin/packages')) {
      if (this.currentUrl.endsWith('/new')) return 'Thêm gói dịch vụ';
      if (this.currentUrl.includes('/edit')) return 'Chỉnh sửa gói dịch vụ';
      if (/\/packages\/[^/]+$/.test(this.currentUrl)) return 'Chi tiết gói dịch vụ';
      return 'Quản lý gói dịch vụ';
    }
    if (this.currentUrl.includes('/admin/addons')) {
      return 'Sản phẩm & Add-on';
    }
    return 'Dashboard';
  }

  isForecastPage(): boolean {
    return this.currentUrl.startsWith('/admin/forecast');
  }

  onRefresh(): void {
    this.isRefreshing = true;
    setTimeout(() => {
      this.isRefreshing = false;
    }, 600);
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: error => console.error('Không thể đăng xuất quản trị viên.', error),
    });
  }
}

export { AdminLayoutComponent as AdminLayout };
