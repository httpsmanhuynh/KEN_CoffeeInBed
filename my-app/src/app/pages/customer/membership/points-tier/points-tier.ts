import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth.service';
import { CustomerApiService } from '../../../../core/customer-api.service';

interface Tx {
  iso: string; title: string; sub: string;
  points: string | null;   // null = không có điểm (hiện "—")
  coins: string; coinsNegative: boolean; note: string;
}

const TIER_META: Record<string, { name: string; discount: number; nextName: string | null; nextMin: number | null }> = {
  BASIC: { name: 'Mới', discount: 0, nextName: 'Bạc', nextMin: 1000 },
  SILVER: { name: 'Bạc', discount: 5, nextName: 'Vàng', nextMin: 5000 },
  GOLD: { name: 'Vàng', discount: 10, nextName: 'Kim Cương', nextMin: 10000 },
  DIAMOND: { name: 'Kim Cương', discount: 15, nextName: null, nextMin: null },
};

@Component({
  selector: 'app-points-tier',
  standalone: false,
  templateUrl: './points-tier.html',
  styleUrl: './points-tier.css',
})
export class PointsTierPage implements OnInit {
  private readonly auth = inject(AuthService, { optional: true });
  private readonly api = inject(CustomerApiService, { optional: true });
  private readonly router = inject(Router, { optional: true });

  tierPoints = 0;
  coinsBalance = 0;
  tierCode = 'BASIC';

  get tierInfo() {
    return TIER_META[this.tierCode] ?? TIER_META['BASIC'];
  }

  get progressPercent(): number {
    const next = this.tierInfo.nextMin;
    if (!next) return 100;
    return Math.min(100, Math.round((this.tierPoints / next) * 100));
  }

  transactions: Tx[] = [];

  filterOpen = false;
  fromDate = '';
  toDate = '';
  private applied = { from: '', to: '' };

  ngOnInit(): void {
    if (!this.api || !this.auth) return;
    this.auth.ensureSession().subscribe({
      next: (user) => {
        if (!user) return;
        this.tierPoints = user.tierPoints ?? 0;
        this.coinsBalance = user.coinsBalance ?? 0;
        this.tierCode = user.membershipTier || 'BASIC';
        this.api!.getLoyaltyHistory().subscribe({
          next: (res) => {
            if (!res?.transactions?.length) {
              this.transactions = [];
              return;
            }
            this.transactions = res.transactions.map((tx) => {
              const iso = new Date(new Date(tx.created_at).getTime() + 7 * 3600000).toISOString().slice(0, 10);
              return {
                iso,
                title: tx.note || tx.type,
                sub: tx.type === 'EARN' ? 'Tích điểm & Coins' : tx.type === 'REDEEM' ? 'Đổi KÉN Coins' : 'Reset đầu năm',
                points: tx.points_delta ? `+${tx.points_delta}` : null,
                coins: `${tx.coins_delta >= 0 ? '+' : ''}${tx.coins_delta}`,
                coinsNegative: tx.coins_delta < 0,
                note: `Điểm: ${tx.points_after.toLocaleString('vi-VN')} · Coins: ${tx.coins_after.toLocaleString('vi-VN')}`,
              };
            });
          },
          error: () => {
            this.transactions = [];
          },
        });
      },
    });
  }

  get rows(): Tx[] {
    const { from, to } = this.applied;
    return this.transactions.filter(t => (!from || t.iso >= from) && (!to || t.iso <= to));
  }

  applyFilter(): void {
    if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
      [this.fromDate, this.toDate] = [this.toDate, this.fromDate];
    }
    this.applied = { from: this.fromDate, to: this.toDate };
    this.filterOpen = false;
  }
  clearFilter(): void { this.fromDate = this.toDate = ''; this.applied = { from: '', to: '' }; this.filterOpen = false; }
  fmtDate(iso: string): string { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
  logout(): void {
    if (!this.auth) return;
    this.auth.logout().subscribe({ next: () => this.router?.navigateByUrl('/') });
  }
}
