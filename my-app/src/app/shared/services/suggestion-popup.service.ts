import { Injectable, signal } from '@angular/core';

const SEEN_KEY = 'ken.afternoonPopupSeen';

/** Điều khiển popup "Một chút gợi ý từ KÉN" (buổi chiều 14:00–17:00). */
@Injectable({ providedIn: 'root' })
export class SuggestionPopupService {
  readonly isOpen = signal(false);

  show(): void { this.isOpen.set(true); }
  hide(): void { this.isOpen.set(false); }

  isAfternoon(now: Date = new Date()): boolean {
    const h = now.getHours();
    return h >= 14 && h < 17;
  }

  /** Tự mở tối đa 1 lần/phiên trong khung chiều; `force` (vd. ?popup=1) bỏ qua điều kiện để xem thử. */
  autoShow(force = false): void {
    if (force || (this.isAfternoon() && !this.seen())) this.show();
  }

  markSeen(): void {
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* bộ nhớ bị chặn: bỏ qua */ }
  }

  private seen(): boolean {
    try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
  }
}
