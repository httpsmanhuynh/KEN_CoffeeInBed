import { Component, OnDestroy } from '@angular/core';

interface Profile { name: string; email: string; gender: string; birthday: string; city: string; }

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-user-profile',
  standalone: false,
  styleUrl: './user-profile.css',
  templateUrl: './user-profile.html',
})
export class UserProfile implements OnDestroy {
  // TODO: lấy từ AuthService / API hồ sơ. Giá trị mặc định theo Figma.
  private saved: Profile = {
    name: 'Thầy Thanh đẹp trai', email: 'thanh@example.com',
    gender: 'Nam', birthday: '1995-05-15', city: 'Thành phố Hồ Chí Minh',
  };
  form: Profile = { ...this.saved };

  readonly today = new Date().toISOString().slice(0, 10);
  readonly phoneMasked = '•••• •• 0123';
  readonly phoneVerified = true;
  readonly tier = 'Bạc';
  readonly points = '3.250';

  readonly genders = ['Nam', 'Nữ', 'Khác', 'Không muốn nói'];
  readonly cities = ['Thành phố Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ', 'Hải Phòng', 'Tỉnh/thành khác'];

  errors: Partial<Record<'name' | 'email', string>> = {};
  message = '';
  messageType: 'ok' | 'error' | '' = '';
  avatarUrl: string | null = null;

  get dirty(): boolean {
    return (Object.keys(this.saved) as (keyof Profile)[]).some(k => this.saved[k] !== this.form[k]);
  }

  onUpdate(): void {
    this.errors = {};
    this.message = '';
    const name = this.form.name.trim();
    const email = this.form.email.trim();
    if (!name) this.errors.name = 'Vui lòng nhập họ và tên.';
    if (!email) this.errors.email = 'Vui lòng nhập email.';
    else if (!EMAIL_RE.test(email)) this.errors.email = 'Email chưa đúng định dạng.';
    if (this.errors.name || this.errors.email) {
      this.messageType = 'error'; this.message = 'Vui lòng kiểm tra lại các trường được đánh dấu.';
      return;
    }
    const emailChanged = email !== this.saved.email;
    this.form = { ...this.form, name, email };
    this.saved = { ...this.form }; // TODO: gọi API cập nhật hồ sơ
    this.messageType = 'ok';
    this.message = emailChanged
      ? 'Đã cập nhật. Email mới cần được xác minh lại trước khi dùng làm thông tin liên hệ.'
      : 'Đã cập nhật thông tin của bạn.';
  }

  onCancel(): void {
    this.form = { ...this.saved };
    this.errors = {};
    this.message = ''; this.messageType = '';
  }

  onAvatarPicked(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      this.messageType = 'error'; this.message = 'Ảnh đại diện chỉ nhận định dạng JPG hoặc PNG.'; return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      this.messageType = 'error'; this.message = 'Ảnh vượt quá 5 MB, vui lòng chọn ảnh nhỏ hơn.'; return;
    }
    if (this.avatarUrl) URL.revokeObjectURL(this.avatarUrl);
    this.avatarUrl = URL.createObjectURL(file); // TODO: tải ảnh lên server
    this.messageType = 'ok'; this.message = 'Đã chọn ảnh mới. Nhấn "Cập nhật" để lưu.';
  }

  logout(): void { console.log('Đăng xuất'); } // TODO: AuthService.logout()
  ngOnDestroy(): void { if (this.avatarUrl) URL.revokeObjectURL(this.avatarUrl); }
}
