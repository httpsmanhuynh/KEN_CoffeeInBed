import { Component } from '@angular/core';

@Component({
  selector: 'app-points-tier',
  standalone: false,
  templateUrl: './points-tier.html',
  styleUrl: './points-tier.css',
})
export class PointsTierPage {
  readonly transactions = [
    { date: '22/10/2026', title: 'Focus Pod · #KEN-221026-018', sub: 'Hoàn thành · 145.000đ', points: '+14,5', coins: '+14', note: 'Số dư: 3.250' },
    { date: '18/10/2026', title: 'Phòng họp nhỏ · #KEN-181026-012', sub: 'Hoàn thành · 355.000đ', points: '+35,5', coins: '+35', note: 'Số dư: 3.235,5' },
    { date: '10/10/2026', title: 'Đổi Voucher giảm 20K', sub: 'Hoàn thành · Dùng 200 Coins', points: '—', coins: '−200', note: 'Coins còn: 650' },
  ];
  filterOpen = false;
  selectedPeriod = 'Tất cả thời gian';
}
