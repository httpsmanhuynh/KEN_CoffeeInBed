import { Component } from '@angular/core';

@Component({
  selector: 'app-focus-page',
  standalone: false,
  templateUrl: './focus-page.html',
  styleUrl: './focus-page.css',
})
export class FocusPage {
  info = '';
  showInfo(): void { this.info = 'Chức năng này cần kết nối với trang Menu hoặc hệ thống đặt chỗ của nhóm. Hiện chưa thực hiện giao dịch.'; }
}
