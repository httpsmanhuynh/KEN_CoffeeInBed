import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth.service';

const TIER_META: Record<string, { name: string; discount: number; nextName: string | null; nextMin: number | null }> = {
  BASIC: { name: 'Mới', discount: 0, nextName: 'Bạc', nextMin: 1000 },
  SILVER: { name: 'Bạc', discount: 5, nextName: 'Vàng', nextMin: 5000 },
  GOLD: { name: 'Vàng', discount: 10, nextName: 'Kim Cương', nextMin: 10000 },
  DIAMOND: { name: 'Kim Cương', discount: 15, nextName: null, nextMin: null },
};

function codeForPoints(points: number): string {
  if (points >= 10000) return 'DIAMOND';
  if (points >= 5000) return 'GOLD';
  if (points >= 1000) return 'SILVER';
  return 'BASIC';
}

@Component({
  selector: 'app-points-tier',
  standalone: false,
  templateUrl: './points-tier.html',
  styleUrl: './points-tier.css',
})
export class PointsTierPage implements OnInit {
  private readonly auth = inject(AuthService, { optional: true });
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
    const currentMin = this.tierCode === 'SILVER' ? 1000 : this.tierCode === 'GOLD' ? 5000 : 0;
    if (this.tierPoints <= currentMin) return 0;
    return Math.min(100, Math.round(((this.tierPoints - currentMin) / (next - currentMin)) * 100));
  }

  ngOnInit(): void {
    if (!this.auth) return;
    const session$ = typeof this.auth.loadSession === 'function'
      ? this.auth.loadSession(true)
      : this.auth.ensureSession();
    session$.subscribe({
      next: (user) => {
        if (!user) return;
        this.tierPoints = user.tierPoints ?? 0;
        this.coinsBalance = user.coinsBalance ?? 0;
        this.tierCode = this.tierPoints >= 1000
          ? codeForPoints(this.tierPoints)
          : (user.membershipTier || 'BASIC');
      },
    });
  }

  logout(): void {
    if (!this.auth) return;
    this.auth.logout().subscribe({ next: () => this.router?.navigateByUrl('/') });
  }
}
