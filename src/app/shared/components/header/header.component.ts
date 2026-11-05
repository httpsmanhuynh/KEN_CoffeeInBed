import { Component, Input, OnInit, isDevMode } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent implements OnInit {
  @Input() isLoggedIn = false;
  @Input() userName = '';

  mobileMenuOpen = false;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Hỗ trợ kiểm tra nhanh cả 2 trạng thái Guest & Customer trong môi trường dev
    // qua URL query param mà không cần sửa AuthService:
    // ?auth=customer (kèm tùy chọn ?name=...) hoặc ?auth=guest
    if (isDevMode()) {
      this.route.queryParams.subscribe((params) => {
        if (params['auth'] === 'customer') {
          this.isLoggedIn = true;
          this.userName = params['name'] || this.userName || 'Thầy Thanh đẹp trai';
        } else if (params['auth'] === 'guest') {
          this.isLoggedIn = false;
        }
      });
    }
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }
}
