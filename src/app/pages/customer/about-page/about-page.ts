import { Component } from '@angular/core';

@Component({
  selector: 'app-about-page',
  standalone: false,
  templateUrl: './about-page.html',
  styleUrl: './about-page.css',
})
export class AboutPage {
  selectedSpace: 'connect' | 'focus' | 'rest' | null = null;

  selectSpace(space: 'connect' | 'focus' | 'rest'): void {
    this.selectedSpace = space;
  }

}
