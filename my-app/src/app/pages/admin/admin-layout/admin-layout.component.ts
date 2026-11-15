import { Component, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
<<<<<<< HEAD
=======
import { AuthService } from '../../../core/auth.service';
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12

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
<<<<<<< HEAD
=======
  readonly auth = inject(AuthService);
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12

  currentUrl = this.router.url;
  isRefreshing = false;
  isUserMenuOpen = false;

  readonly navItems: AdminNavItem[] = [
<<<<<<< HEAD
    { id: 'nav-dashboard', label: 'Tổng quan', path: '/admin/dashboard', icon: 'images/admin/nav-table.svg', exact: true },
    { id: 'nav-booking', label: 'Đặt chỗ', path: '/admin/bookings', icon: 'images/admin/nav-calendar.svg' },
    { id: 'nav-cust', label: 'Khách hàng', path: '/admin/customers', icon: 'images/admin/nav-wifi.svg' },
    { id: 'nav-zone', label: 'Khu vực', path: '/admin/zones', icon: 'images/admin/nav-sidebar-inset.svg' },
    { id: 'nav-space', label: 'Không gian', path: '/admin/spaces', icon: 'images/admin/nav-sidebar-reverse.svg' },
    { id: 'nav-pkg', label: 'Gói dịch vụ', path: '/admin/packages', icon: 'images/admin/nav-calendar-check.svg' },
    { id: 'nav-addon', label: 'Sản phẩm & Add-on', path: '/admin/addons', icon: 'images/admin/nav-outlet.svg' },
    { id: 'nav-voucher', label: 'Voucher', path: '/admin/vouchers', icon: 'images/admin/nav-voucher.svg' },
    { id: 'nav-rev', label: 'Doanh thu', path: '/admin/revenue', icon: 'images/admin/nav-revenue.svg' },
    { id: 'nav-fore', label: 'Dự báo món', path: '/admin/forecast', icon: 'images/admin/nav-forecast.svg' },
    { id: 'nav-rec', label: 'Món thường đi cùng', path: '/admin/combos', icon: 'images/admin/nav-combos.svg' },
=======
    { id: 'nav-dashboard', label: 'Tổng quan', path: '/admin/dashboard', icon: '/images/figma/table.svg', exact: true },
    { id: 'nav-booking', label: 'Đặt chỗ', path: '/admin/bookings', icon: '/images/figma/lich-dat-cho.svg' },
    { id: 'nav-cust', label: 'Khách hàng', path: '/admin/customers', icon: '/images/ken-about/value-people.svg' },
    { id: 'nav-zone', label: 'Khu vực', path: '/admin/zones', icon: '/images/ken-home/icons/branch-pin.svg' },
    { id: 'nav-space', label: 'Không gian', path: '/admin/spaces', icon: '/images/ken-about/focus-icon.svg' },
    { id: 'nav-pkg', label: 'Gói dịch vụ', path: '/admin/packages', icon: '/images/figma/calendar-clock.svg' },
    { id: 'nav-addon', label: 'Sản phẩm & Add-on', path: '/admin/addons', icon: '/images/ken-flow/icons/listing-outlet.svg' },
    { id: 'nav-voucher', label: 'Voucher', path: '/admin/vouchers', icon: '/images/figma-gift.svg' },
    { id: 'nav-fore', label: 'Dự báo món', path: '/admin/forecast', icon: '/images/figma/table.svg' },
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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
<<<<<<< HEAD
    return this.currentUrl.startsWith(item.path);
  }

=======
    if (item.path === '/admin/zones' && this.currentUrl.startsWith('/admin/areas')) {
      return true;
    }
    return this.currentUrl.startsWith(item.path);
  }

  get activeModuleIndex(): number {
    const idx = this.navItems.findIndex((item) => this.isItemActive(item));
    return idx >= 0 ? idx : 0;
  }

  get prevNavItem(): AdminNavItem | null {
    const idx = this.activeModuleIndex;
    return idx > 0 ? this.navItems[idx - 1] : null;
  }

  get nextNavItem(): AdminNavItem | null {
    const idx = this.activeModuleIndex;
    return idx >= 0 && idx < this.navItems.length - 1 ? this.navItems[idx + 1] : null;
  }

  goPrevPage(): void {
    const target = this.prevNavItem;
    if (target) {
      this.router.navigate([target.path]);
    }
  }

  goNextPage(): void {
    const target = this.nextNavItem;
    if (target) {
      this.router.navigate([target.path]);
    }
  }

>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  getCurrentPageTitle(): string {
    if (this.currentUrl.includes('/admin/bookings')) {
      return 'Quản lý Booking';
    }
    if (this.currentUrl.includes('/admin/customers')) {
      return 'Khách hàng & Thành viên';
    }
    if (this.currentUrl.includes('/admin/areas') || this.currentUrl.includes('/admin/zones')) {
<<<<<<< HEAD
      return this.currentUrl.includes('/new') || /\/areas\/[^/]+$/.test(this.currentUrl) ? 'Thêm khu vực' : 'Quản lý khu vực';
=======
      if (this.currentUrl.includes('/new')) return 'Thêm khu vực';
      if (/\/(?:areas|zones)\/[^/]+$/.test(this.currentUrl)) return 'Chi tiết khu vực';
      return 'Quản lý khu vực';
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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
<<<<<<< HEAD
=======
    if (this.currentUrl.includes('/admin/vouchers')) {
      return 'Khuyến mãi & Voucher';
    }
    if (this.currentUrl.includes('/admin/forecast')) {
      return 'Dự báo & Recommend';
    }
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
    return 'Dashboard';
  }

  isForecastPage(): boolean {
    return this.currentUrl.startsWith('/admin/forecast');
  }

  onRefresh(): void {
    this.isRefreshing = true;
<<<<<<< HEAD
=======
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ken-admin-refresh'));
    }
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
    setTimeout(() => {
      this.isRefreshing = false;
    }, 600);
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }
<<<<<<< HEAD
=======

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: error => console.error('Không thể đăng xuất quản trị viên.', error),
    });
  }
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
}

export { AdminLayoutComponent as AdminLayout };
