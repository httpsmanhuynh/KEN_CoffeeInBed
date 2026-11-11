import { Injectable, signal } from '@angular/core';

/** Điều khiển popup gợi ý món trong một phiên truy cập website. */
@Injectable({ providedIn: 'root' })
export class SuggestionPopupService {
  private readonly sessionKey = 'ken-suggestion-popup-shown';
  readonly isOpen = signal(false);
  readonly openVersion = signal(0);

  showOncePerSession(): boolean {
    if (sessionStorage.getItem(this.sessionKey) === '1') return false;
    sessionStorage.setItem(this.sessionKey, '1');
    this.show();
    return true;
  }

  show(): void {
    this.isOpen.set(true);
    this.openVersion.update(version => version + 1);
  }
  hide(): void { this.isOpen.set(false); }
}
