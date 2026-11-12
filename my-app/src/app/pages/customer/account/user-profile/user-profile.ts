import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth.service';
import { CustomerApiService } from '../../../../core/customer-api.service';

interface Profile { name: string; email: string; gender: string; birthday: string; city: string; }

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIER_LABEL: Record<string, string> = {
  BASIC: 'Mới',
  SILVER: 'Bạc',
  GOLD: 'Vàng',
  DIAMOND: 'Kim Cương',
};

@Component({
  selector: 'app-user-profile',
  standalone: false,
  styleUrl: './user-profile.css',
  templateUrl: './user-profile.html',
})
export class UserProfile implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService, { optional: true });
  private readonly api = inject(CustomerApiService, { optional: true });
  private readonly router = inject(Router, { optional: true });

  private saved: Profile = {
    name: 'Thầy Thanh đẹp trai', email: 'thanh@example.com',
    gender: 'Nam', birthday: '1995-05-15', city: 'Thành phố Hồ Chí Minh',
  };
  form: Profile = { ...this.saved };

  readonly today = new Date().toISOString().slice(0, 10);
  phoneMasked = '•••• •• 0123';
  readonly phoneVerified = true;
  tier = 'Bạc';
  points = '3.250';

  ngOnInit(): void {
    this.auth?.ensureSession().subscribe({
      next: (user) => {
        if (!user) return;
        let extra: Partial<Pick<Profile, 'gender' | 'birthday' | 'city'>> = {};
        try {
          const raw = localStorage.getItem(`ken-profile-extra-${user.id}`);
          if (raw) extra = JSON.parse(raw);
        } catch {}
        this.saved = {
          ...this.saved,
          ...extra,
          name: user.fullName,
          email: user.email || '',
        };
        this.form = { ...this.saved };
        this.phoneMasked = user.phone.length >= 4 ? `•••• •• ${user.phone.slice(-4)}` : user.phone;
        this.tier = TIER_LABEL[user.membershipTier] ?? user.membershipTier;
        this.points = user.tierPoints.toLocaleString('vi-VN');
        this.avatarUrl = this.auth?.avatarUrl() ?? null;
      },
    });
  }

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
    if (this.api && this.auth?.user) {
      const uid = this.auth.user.id;
      try {
        localStorage.setItem(
          `ken-profile-extra-${uid}`,
          JSON.stringify({ gender: this.form.gender, birthday: this.form.birthday, city: this.form.city }),
        );
      } catch {}
      const payload: { fullName?: string; email?: string } = { fullName: name };
      if (emailChanged) payload.email = email;
      this.api.updateProfile(payload).subscribe({
        next: (updated) => {
          this.auth?.setUser(updated);
          this.form = { ...this.form, name: updated.fullName, email: updated.email || '' };
          this.saved = { ...this.form };
          this.messageType = 'ok';
          this.message = 'Đã cập nhật thông tin của bạn vào hệ thống.';
          this.triggerSuccessToast();
        },
        error: (err: HttpErrorResponse) => {
          this.messageType = 'error';
          this.message =
            err.error?.code === 'INVALID_CURRENT_PASSWORD'
              ? 'Đổi email cần xác nhận mật khẩu hiện tại (hãy đổi họ tên riêng hoặc dùng trang Bảo mật).'
              : err.error?.message || 'Không thể cập nhật hồ sơ. Vui lòng thử lại.';
        },
      });
      return;
    }
    this.form = { ...this.form, name, email };
    this.saved = { ...this.form };
    this.messageType = 'ok';
    this.message = emailChanged
      ? 'Đã cập nhật. Email mới cần được xác minh lại trước khi dùng làm thông tin liên hệ.'
      : 'Đã cập nhật thông tin của bạn.';
    this.triggerSuccessToast();
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
    if (this.avatarUrl && this.avatarUrl.startsWith('blob:')) URL.revokeObjectURL(this.avatarUrl);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      this.avatarUrl = dataUrl;
      this.auth?.setAvatar(dataUrl);
    };
    reader.readAsDataURL(file);
    this.messageType = 'ok'; this.message = 'Đã cập nhật ảnh đại diện.';
  }

  showToast = false;
  private toastTimer?: ReturnType<typeof setTimeout>;

  triggerSuccessToast(): void {
    this.showToast = false;
    clearTimeout(this.toastTimer);
    setTimeout(() => {
      this.showToast = true;
      this.toastTimer = setTimeout(() => {
        this.showToast = false;
      }, 3500);
    }, 10);
  }

  logout(): void {
    if (!this.auth) return;
    this.auth.logout().subscribe({ next: () => this.router?.navigateByUrl('/') });
  }
  ngOnDestroy(): void {
    clearTimeout(this.toastTimer);
    if (this.avatarUrl) URL.revokeObjectURL(this.avatarUrl);
  }
}
