import { Component, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

export interface ZoneItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  canBook: boolean;
  canBookLabel: string;
  spacesCount: number;
  activeSpacesCount: number;
  status: 'ACTIVE' | 'HIDDEN';
  statusLabel: string;
  tagColorClass: string;
}

@Component({
  selector: 'app-areas',
  standalone: false,
  styleUrl: './areas.component.css',
  templateUrl: './areas.component.html',
})
export class AreasComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Chế độ xem: 'list' (Danh sách 125:2) hoặc 'form' (Thêm/Sửa 125:2030)
  viewMode: 'list' | 'form' = 'list';
  formTitle = 'Thêm khu vực';
  isEditing = false;
  editingZoneId: string | null = null;

  // Form model
  formData = {
    name: '',
    slug: '',
    description: '',
    status: 'ACTIVE' as 'ACTIVE' | 'HIDDEN',
    canBook: true,
  };

  zones: ZoneItem[] = [
    {
      id: 'z1',
      name: 'KÉN Kết Nối',
      slug: 'ken-ket-noi',
      description: 'Khu vực café & catalog, không gian mở gặp gỡ kết nối cộng đồng.',
      canBook: false,
      canBookLabel: 'Không nhận',
      spacesCount: 0,
      activeSpacesCount: 0,
      status: 'ACTIVE',
      statusLabel: 'Hoạt động',
      tagColorClass: 'tag-brand-gold',
    },
    {
      id: 'z2',
      name: 'KÉN Tập Trung',
      slug: 'ken-tap-trung',
      description: 'Không gian làm việc yên tĩnh, bàn cá nhân và phòng họp nhóm tập trung cao.',
      canBook: true,
      canBookLabel: 'Có thể đặt',
      spacesCount: 4,
      activeSpacesCount: 4,
      status: 'ACTIVE',
      statusLabel: 'Hoạt động',
      tagColorClass: 'tag-brand-gold',
    },
    {
      id: 'z3',
      name: 'KÉN Tái Tạo',
      slug: 'ken-tai-tao',
      description: 'Khu vực nghỉ ngơi, thư giãn, giường kén cá nhân và trị liệu âm thanh nhẹ nhàng.',
      canBook: true,
      canBookLabel: 'Có thể đặt',
      spacesCount: 3,
      activeSpacesCount: 2,
      status: 'ACTIVE',
      statusLabel: 'Hoạt động',
      tagColorClass: 'tag-brand-dark',
    },
  ];

  ngOnInit(): void {
    // Check nếu url là /new
    this.route.url.subscribe(() => {
      const path = this.router.url;
      if (path.endsWith('/new')) {
        this.openCreateForm();
      } else {
        this.viewMode = 'list';
      }
    });
  }

  get totalSpaces(): number {
    return this.zones.reduce((sum, z) => sum + z.spacesCount, 0);
  }

  openCreateForm(): void {
    this.isEditing = false;
    this.editingZoneId = null;
    this.formTitle = 'Thêm khu vực';
    this.formData = {
      name: '',
      slug: '',
      description: '',
      status: 'ACTIVE',
      canBook: true,
    };
    this.viewMode = 'form';
  }

  openEditForm(z: ZoneItem): void {
    this.isEditing = true;
    this.editingZoneId = z.id;
    this.formTitle = `Chỉnh sửa khu vực · ${z.name}`;
    this.formData = {
      name: z.name,
      slug: z.slug,
      description: z.description,
      status: z.status,
      canBook: z.canBook,
    };
    this.viewMode = 'form';
  }

  cancelForm(): void {
    this.viewMode = 'list';
    if (this.router.url.includes('/new')) {
      this.router.navigate(['/admin/zones']);
    }
  }

  saveZone(): void {
    if (!this.formData.name.trim()) {
      alert('Vui lòng nhập tên khu vực (Zone)!');
      return;
    }

    if (this.isEditing && this.editingZoneId) {
      const idx = this.zones.findIndex((z) => z.id === this.editingZoneId);
      if (idx !== -1) {
        this.zones[idx] = {
          ...this.zones[idx],
          name: this.formData.name,
          description: this.formData.description,
          status: this.formData.status,
          statusLabel: this.formData.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm ẩn',
          canBook: this.formData.canBook,
          canBookLabel: this.formData.canBook ? 'Có thể đặt' : 'Không nhận',
        };
        alert(`Đã cập nhật thành công khu vực: ${this.formData.name}`);
      }
    } else {
      const slug = this.formData.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

      const newZone: ZoneItem = {
        id: `z${Date.now()}`,
        name: this.formData.name,
        slug: slug || 'ken-zone',
        description: this.formData.description || 'Chưa có mô tả cho khu vực này.',
        canBook: this.formData.canBook,
        canBookLabel: this.formData.canBook ? 'Có thể đặt' : 'Không nhận',
        spacesCount: 0,
        activeSpacesCount: 0,
        status: this.formData.status,
        statusLabel: this.formData.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm ẩn',
        tagColorClass: 'tag-brand-gold',
      };
      this.zones.push(newZone);
      alert(`Đã tạo mới thành công khu vực: ${newZone.name}`);
    }

    this.cancelForm();
  }

  toggleHideZone(z: ZoneItem): void {
    if (z.status === 'ACTIVE') {
      if (confirm(`Bạn có chắc chắn muốn TẠM ẨN khu vực "${z.name}" (Soft Delete)? Khu vực sẽ bị ẩn trên trang khách hàng nhưng vẫn lưu lịch sử.`)) {
        z.status = 'HIDDEN';
        z.statusLabel = 'Tạm ẩn';
      }
    } else {
      if (confirm(`KÍCH HOẠT LẠI khu vực "${z.name}"?`)) {
        z.status = 'ACTIVE';
        z.statusLabel = 'Hoạt động';
      }
    }
  }

  exportList(): void {
    alert('Đang xuất danh sách khu vực sang file Excel/CSV...');
  }
}

export { AreasComponent as Areas };
