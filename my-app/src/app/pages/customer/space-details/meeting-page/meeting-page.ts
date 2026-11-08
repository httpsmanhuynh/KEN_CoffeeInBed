import { Component } from '@angular/core';

@Component({
  selector: 'app-meeting-page',
  standalone: false,
  templateUrl: './meeting-page.html',
  styleUrl: './meeting-page.css',
})
export class MeetingPage {
  info = '';
  showInfo(): void { this.info = 'Chức năng này cần kết nối với trang Menu hoặc hệ thống đặt chỗ của nhóm. Hiện chưa thực hiện giao dịch.'; }
}
