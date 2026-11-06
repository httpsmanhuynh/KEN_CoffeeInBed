import { Component } from '@angular/core';

@Component({
  selector: 'app-user-profile',
  standalone: false,
  styleUrl: './user-profile.css',
  templateUrl: './user-profile.html',
})
export class UserProfile {
  user = {
    name: 'Thầy Thanh đẹp trai',
    email: 'thanh@example.com',
    phone: '•••• •• 0123',
    phoneVerified: true,
    gender: 'Nam',
    birthday: '15/05/1995',
    city: 'Thành phố Hồ Chí Minh',
    tier: 'Bạc',
    points: '3.250 điểm',
    discount: 'giảm 5% tổng hoá đơn'
  };

  onUpdate() {
    console.log('Cập nhật thông tin thành công!');
  }

  onCancel() {
    console.log('Huỷ chỉnh sửa');
  }

}
