import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BookingMode, SpaceItem, SpaceStatus, SpacesService } from './spaces.service';

interface SpaceFormData {
  zone: string;
  name: string;
  nameEn: string;
  capacity: number;
  minGuest: number;
  maxGuest: number;
  bookingMode: BookingMode;
  status: SpaceStatus;
  amenities: string[];
}

@Component({
  selector: 'app-spaces',
  standalone: false,
  styleUrl: './spaces.component.css',
  templateUrl: './spaces.component.html',
})
export class SpacesComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly spacesService = inject(SpacesService);

  spaces: SpaceItem[] = [];
  viewMode: 'list' | 'form' = 'list';
  isEditing = false;
  editingId: string | null = null;
  viewingSpace: SpaceItem | null = null;

  // Filter & Search states
  searchQuery = '';
  selectedZone = 'Tất cả';
  selectedStatus = 'Tất cả';
  activeTab: 'ALL' | 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE' = 'ALL';
  sortAscending = true;

  // Form model
  formData: SpaceFormData = this.getEmptyForm();
  formError = '';
  toastMessage: string | null = null;
  toastType: 'success' | 'info' = 'success';

  readonly allAmenityOptions: { label: string; icon: string }[] = [
    { label: 'WiFi', icon: 'images/admin/icon-wifi-service.svg' },
    { label: 'Ổ cắm điện', icon: 'images/admin/icon-plug-service.svg' },
    { label: 'Đặt chỗ trực tuyến', icon: 'images/admin/icon-calendar-list.svg' },
    { label: 'Đặt theo giờ', icon: 'images/admin/clock-icon.svg' },
  ];

  readonly zoneOptions = ['KÉN Tập Trung', 'KÉN Tái Tạo', 'KÉN Kết Nối'];

  ngOnInit(): void {
    this.spacesService.spaces$.subscribe((spaces) => {
      this.spaces = spaces;
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      const url = this.router.url;
      if (url.endsWith('/new')) {
        this.openCreateForm();
      } else if (id && url.includes('/edit')) {
        const space = this.spacesService.findById(id);
        if (space) {
          this.openEditForm(space);
        } else {
          this.router.navigate(['/admin/spaces']);
        }
      } else {
        this.viewMode = 'list';
      }
    });
  }

  // --- STATS COMPUTATIONS ---
  get totalCount(): number {
    return this.spaces.length;
  }

  get activeCount(): number {
    return this.spaces.filter((s) => s.status === 'ACTIVE').length;
  }

  get maintenanceCount(): number {
    return this.spaces.filter((s) => s.status === 'MAINTENANCE').length;
  }

  get inactiveCount(): number {
    return this.spaces.filter((s) => s.status === 'INACTIVE').length;
  }

  get zoneTapTrungCount(): number {
    return this.spaces.filter((s) => s.zone === 'KÉN Tập Trung').length;
  }

  get zoneTaiTaoCount(): number {
    return this.spaces.filter((s) => s.zone === 'KÉN Tái Tạo').length;
  }

  // --- FILTERED & SORTED SPACES ---
  get filteredSpaces(): SpaceItem[] {
    const q = this.searchQuery.trim().toLowerCase();

    return this.spaces
      .filter((s) => {
        // Search query
        const matchesQuery =
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.nameEn.toLowerCase().includes(q) ||
          s.zone.toLowerCase().includes(q);

        // Zone filter
        const matchesZone = this.selectedZone === 'Tất cả' || s.zone === this.selectedZone;

        // Status filter
        let matchesStatus = true;
        if (this.selectedStatus !== 'Tất cả') {
          if (this.selectedStatus === 'Đang hoạt động') matchesStatus = s.status === 'ACTIVE';
          else if (this.selectedStatus === 'Bảo trì') matchesStatus = s.status === 'MAINTENANCE';
          else if (this.selectedStatus === 'Ngừng hoạt động') matchesStatus = s.status === 'INACTIVE';
        }

        // Tab filter
        let matchesTab = true;
        if (this.activeTab === 'ACTIVE') matchesTab = s.status === 'ACTIVE';
        else if (this.activeTab === 'MAINTENANCE') matchesTab = s.status === 'MAINTENANCE';
        else if (this.activeTab === 'INACTIVE') matchesTab = s.status === 'INACTIVE';

        return matchesQuery && matchesZone && matchesStatus && matchesTab;
      })
      .sort((a, b) => {
        const order = this.sortAscending ? 1 : -1;
        return a.name.localeCompare(b.name, 'vi') * order;
      });
  }

  // --- ACTIONS ---
  setTab(tab: 'ALL' | 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE'): void {
    this.activeTab = tab;
  }

  toggleSort(): void {
    this.sortAscending = !this.sortAscending;
    this.showToast(`Đã sắp xếp theo tên ${this.sortAscending ? 'A-Z' : 'Z-A'}`);
  }

  openCreateForm(): void {
    this.viewMode = 'form';
    this.isEditing = false;
    this.editingId = null;
    this.formData = this.getEmptyForm();
    this.formError = '';
    if (!this.router.url.endsWith('/new')) {
      this.router.navigate(['/admin/spaces/new']);
    }
  }

  openEditForm(space: SpaceItem): void {
    this.viewMode = 'form';
    this.isEditing = true;
    this.editingId = space.id;
    this.formData = {
      zone: space.zone,
      name: space.name,
      nameEn: space.nameEn,
      capacity: space.capacity,
      minGuest: space.minGuest,
      maxGuest: space.maxGuest,
      bookingMode: space.bookingMode,
      status: space.status,
      amenities: [...space.amenities],
    };
    this.formError = '';
    const targetUrl = `/admin/spaces/${space.id}/edit`;
    if (this.router.url !== targetUrl) {
      this.router.navigate(['/admin/spaces', space.id, 'edit']);
    }
  }

  openViewModal(space: SpaceItem): void {
    this.viewingSpace = space;
  }

  closeViewModal(): void {
    this.viewingSpace = null;
  }

  cancelForm(): void {
    this.viewMode = 'list';
    this.isEditing = false;
    this.editingId = null;
    this.router.navigate(['/admin/spaces']);
  }

  hasAmenity(amenity: string): boolean {
    return this.formData.amenities.includes(amenity);
  }

  toggleAmenity(amenity: string): void {
    const idx = this.formData.amenities.indexOf(amenity);
    if (idx > -1) {
      this.formData.amenities.splice(idx, 1);
    } else {
      this.formData.amenities.push(amenity);
    }
  }

  saveSpace(): void {
    // Validation
    if (!this.formData.zone) {
      this.formError = 'Vui lòng chọn Zone (Khu vực).';
      return;
    }
    if (!this.formData.name.trim()) {
      this.formError = 'Vui lòng nhập tên không gian tiếng Việt.';
      return;
    }
    if (!this.formData.nameEn.trim()) {
      this.formError = 'Vui lòng nhập tên tiếng Anh (English name).';
      return;
    }
    if (this.formData.capacity < 1) {
      this.formError = 'Sức chứa (Capacity) phải lớn hơn hoặc bằng 1.';
      return;
    }
    if (this.formData.minGuest < 1) {
      this.formError = 'Số khách tối thiểu (Min Guest) phải lớn hơn hoặc bằng 1.';
      return;
    }
    if (this.formData.maxGuest < this.formData.minGuest) {
      this.formError = 'Số khách tối đa (Max Guest) phải lớn hơn hoặc bằng Min Guest.';
      return;
    }
    if (this.formData.maxGuest > this.formData.capacity) {
      this.formError = 'Quy tắc: MIN ≤ MAX ≤ Sức chứa. Số khách tối đa không vượt quá Capacity.';
      return;
    }

    const isShared = this.formData.bookingMode === 'SHARED';
    this.spacesService.save(
      {
        zone: this.formData.zone,
        name: this.formData.name.trim(),
        nameEn: this.formData.nameEn.trim(),
        capacity: Number(this.formData.capacity),
        minGuest: Number(this.formData.minGuest),
        maxGuest: Number(this.formData.maxGuest),
        bookingMode: this.formData.bookingMode,
        type: isShared ? 'Dùng chung' : 'Dùng riêng',
        priceLabel: isShared ? 'Theo người' : 'Theo không gian',
        status: this.formData.status,
        amenities: [...this.formData.amenities],
      },
      this.editingId ?? undefined
    );

    const actionText = this.isEditing ? 'Cập nhật' : 'Thêm mới';
    this.showToast(`${actionText} không gian "${this.formData.name}" thành công!`);
    this.cancelForm();
  }

  toggleSpaceStatus(space: SpaceItem): void {
    this.spacesService.toggleStatus(space.id);
    const updated = this.spacesService.findById(space.id);
    if (updated?.status === 'ACTIVE') {
      this.showToast(`Đã kích hoạt lại không gian "${space.name}"`);
    } else {
      this.showToast(`Đã chuyển không gian "${space.name}" sang trạng thái Ngừng hoạt động (vẫn bảo toàn lịch sử)`);
    }
  }

  exportList(): void {
    const headers = ['ID', 'Tên không gian', 'Tên tiếng Anh', 'Zone', 'Hình thức', 'Sức chứa', 'Min', 'Max', 'Đơn giá', 'Trạng thái'];
    const rows = this.spaces.map((s) => [
      s.id,
      `"${s.name}"`,
      `"${s.nameEn}"`,
      `"${s.zone}"`,
      `"${s.type}"`,
      s.capacity,
      s.minGuest,
      s.maxGuest,
      `"${s.priceLabel}"`,
      s.status === 'ACTIVE' ? 'Đang hoạt động' : s.status === 'MAINTENANCE' ? 'Bảo trì' : 'Ngừng hoạt động',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ken-danh-sach-khong-gian-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.showToast('Đã xuất danh sách không gian dạng CSV thành công!');
  }

  showToast(message: string, type: 'success' | 'info' = 'success'): void {
    this.toastMessage = message;
    this.toastType = type;
    setTimeout(() => {
      this.toastMessage = null;
    }, 3500);
  }

  private getEmptyForm(): SpaceFormData {
    return {
      zone: 'KÉN Tập Trung',
      name: '',
      nameEn: '',
      capacity: 1,
      minGuest: 1,
      maxGuest: 1,
      bookingMode: 'SHARED',
      status: 'ACTIVE',
      amenities: ['WiFi', 'Ổ cắm điện', 'Đặt chỗ trực tuyến'],
    };
  }
}

export { SpacesComponent as Spaces };
