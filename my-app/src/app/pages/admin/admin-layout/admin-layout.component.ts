import { Component, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

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

  currentUrl = this.router.url;
  isRefreshing = false;
  isUserMenuOpen = false;

  readonly navItems: AdminNavItem[] = [
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
      return 'Quản lý khách hàng';
    }
    if (this.currentUrl.includes('/admin/areas') || this.currentUrl.includes('/admin/zones')) {
      return this.currentUrl.includes('/new') || /\/areas\/[^/]+$/.test(this.currentUrl) ? 'Thêm khu vực' : 'Quản lý khu vực';
    }
    return 'Dashboard';
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
}

export { AdminLayoutComponent as AdminLayout };
