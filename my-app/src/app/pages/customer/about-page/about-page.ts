import { Component, inject } from '@angular/core';
import { SmoothScrollService } from '../../../core/smooth-scroll.service';

@Component({
  selector: 'app-about-page',
  standalone: false,
  templateUrl: './about-page.html',
  styleUrl: './about-page.css',
})
export class AboutPage {
  private readonly smoothScroll = inject(SmoothScrollService);
  selectedSpace: 'connect' | 'focus' | 'rest' | null = null;

  selectSpace(space: 'connect' | 'focus' | 'rest'): void {
    this.selectedSpace = space;
    this.smoothScroll.animateSpaceSwitch(`.about-space-card.${space}`);
  }

}
