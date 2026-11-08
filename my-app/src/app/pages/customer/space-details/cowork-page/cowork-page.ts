import { Component } from '@angular/core';

@Component({
  selector: 'app-cowork-page',
  standalone: false,
  templateUrl: './cowork-page.html',
  styleUrl: './cowork-page.css',
})
export class CoworkPage {
  info = '';
  showInfo(): void { this.info = 'Chức năng này cần kết nối với trang Menu hoặc hệ thống đặt chỗ của nhóm. Hiện chưa thực hiện giao dịch.'; }
}
