import { Component, EventEmitter, Input, Output } from '@angular/core';

export type AccountSection = 'points' | 'coins' | 'bookings' | 'reschedule' | 'account';

interface SidebarItem { key: AccountSection; label: string; path: string; icon: string; }

/** Sidebar tài khoản dùng chung cho mọi trang trong khu vực thành viên (Figma: 248px). */
@Component({
  selector: 'app-account-sidebar',
  standalone: false,
  templateUrl: './account-sidebar.html',
  styleUrl: './account-sidebar.css',
})
export class AccountSidebar {
  @Input() active: AccountSection = 'bookings';
  // TODO: lấy từ AuthService khi có API hồ sơ
  @Input() userName = 'Thầy Thanh đẹp trai';
  @Input() tier = 'Bạc';
  @Input() points = '3.250 điểm';
  @Output() logout = new EventEmitter<void>();

  readonly items: SidebarItem[] = [
    { key: 'points',     label: 'KÉN Điểm',        path: '/points-tier',       icon: 'sparkles' },
    { key: 'coins',      label: 'KÉN Coins',       path: '/coins-rewards',     icon: 'coins' },
    { key: 'bookings',   label: 'Lịch sử đặt chỗ', path: '/booking-list',      icon: 'lich-dat-cho' },
    { key: 'reschedule', label: 'Đổi / Huỷ lịch',  path: '/booking-reschedule', icon: 'calendar-clock' },
    { key: 'account',    label: 'Tài khoản',       path: '/user-profile',      icon: 'user-round' },
  ];
}
