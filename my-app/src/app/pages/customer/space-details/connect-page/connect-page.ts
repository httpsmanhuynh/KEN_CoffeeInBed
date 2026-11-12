import { Component } from '@angular/core';

@Component({
  selector: 'app-connect-page',
  standalone: false,
  templateUrl: './connect-page.html',
  styleUrl: './connect-page.css',
})
export class ConnectPage {
  info = '';
  showInfo(): void { this.info = 'Chức năng này cần kết nối với trang Menu hoặc hệ thống đặt chỗ của nhóm. Hiện chưa thực hiện giao dịch.'; }
}
