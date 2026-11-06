import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { MEMBER_PATHS } from './core/nav-links';

@Component({
  selector: 'app-root',
  standalone: false,
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);

  /** true = đang ở khu vực thành viên -> header đã đăng nhập (avatar + tên). */
  protected readonly member = signal(this.isMember(this.router.url));

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.member.set(this.isMember(e.urlAfterRedirects)));
  }

  private isMember(url: string): boolean {
    return MEMBER_PATHS.includes(url.split(/[?#]/)[0]);
  }
}
