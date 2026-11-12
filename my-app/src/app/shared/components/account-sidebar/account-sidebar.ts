import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { AuthService } from '../../../core/auth.service';

export type AccountSection = 'points' | 'coins' | 'bookings' | 'reschedule' | 'account';

interface SidebarItem { key: AccountSection; label: string; path: string; icon: string; }

const TIER_LABEL: Record<string, string> = {
  BASIC: 'Mới',
  SILVER: 'Bạc',
  GOLD: 'Vàng',
  DIAMOND: 'Kim Cương',
};

/** Sidebar tài khoản dùng chung cho mọi trang trong khu vực thành viên (Figma: 248px). */
@Component({
  selector: 'app-account-sidebar',
  standalone: false,
  templateUrl: './account-sidebar.html',
  styleUrl: './account-sidebar.css',
})
export class AccountSidebar {
  private readonly auth = inject(AuthService, { optional: true });

  @Input() active: AccountSection = 'bookings';
  @Input() userName?: string;
  @Input() tier?: string;
  @Input() points?: string;
  @Output() logout = new EventEmitter<void>();

  get displayName(): string {
    return this.userName ?? this.auth?.user?.fullName ?? 'Thầy Thanh đẹp trai';
  }

  get displayTier(): string {
    if (this.tier) return this.tier;
    const code = this.auth?.user?.membershipTier;
    return code ? (TIER_LABEL[code] ?? code) : 'Bạc';
  }

  get displayPoints(): string {
    if (this.points) return this.points;
    const pts = this.auth?.user?.tierPoints;
    return pts !== undefined ? `${pts.toLocaleString('vi-VN')} điểm` : '3.250 điểm';
  }

  get displayAvatar(): string | null {
    return this.auth?.avatarUrl() ?? null;
  }

  readonly items: SidebarItem[] = [
    { key: 'points',     label: 'KÉN Điểm',        path: '/points-tier',       icon: 'sparkles' },
    { key: 'coins',      label: 'KÉN Coins',       path: '/coins-rewards',     icon: 'coins' },
    { key: 'bookings',   label: 'Lịch sử đặt chỗ', path: '/booking-list',      icon: 'lich-dat-cho' },
    { key: 'reschedule', label: 'Đổi / Huỷ lịch',  path: '/booking-reschedule', icon: 'calendar-clock' },
    { key: 'account',    label: 'Tài khoản',       path: '/user-profile',      icon: 'user-round' },
  ];
}
