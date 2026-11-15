<<<<<<< HEAD
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
=======
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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
<<<<<<< HEAD
=======
  image: string;
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
}

@Component({
  selector: 'app-spaces',
  standalone: false,
  styleUrl: './spaces.component.css',
  templateUrl: './spaces.component.html',
})
<<<<<<< HEAD
export class SpacesComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly spacesService = inject(SpacesService);

  spaces: SpaceItem[] = [];
=======
export class SpacesComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router, { optional: true });
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly cdr = inject(ChangeDetectorRef, { optional: true });
  readonly spacesService = inject(SpacesService);

  spaces: SpaceItem[] = [];
  zoneOptions = ['KÉN Tập Trung', 'KÉN Tái Tạo', 'KÉN Kết Nối'];

>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  viewMode: 'list' | 'form' = 'list';
  isEditing = false;
  editingId: string | null = null;
  viewingSpace: SpaceItem | null = null;
<<<<<<< HEAD

  // Filter & Search states
=======
  confirmToggleTarget: SpaceItem | null = null;
  loading = false;
  saving = false;

>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  searchQuery = '';
  selectedZone = 'Tất cả';
  selectedStatus = 'Tất cả';
  activeTab: 'ALL' | 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE' = 'ALL';
  sortAscending = true;
<<<<<<< HEAD

  // Form model
=======
  currentPage = 1;
  readonly pageSize = 8;

>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  formData: SpaceFormData = this.getEmptyForm();
  formError = '';
  toastMessage: string | null = null;
  toastType: 'success' | 'info' = 'success';
<<<<<<< HEAD

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
=======
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private subs = new Subscription();

  readonly allAmenityOptions: { label: string; icon: string }[] = [
    { label: 'WiFi', icon: '/images/ken-figma/cowork-page-wifi.svg' },
    { label: 'Ổ cắm điện', icon: '/images/ken-figma/cowork-page-outlet.svg' },
    { label: 'Đặt chỗ trực tuyến', icon: '/images/figma/lich-dat-cho.svg' },
    { label: 'Đặt theo giờ', icon: '/images/figma/clock.svg' },
  ];

  private readonly onAdminRefresh = () => {
    this.loadData();
  };

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('ken-admin-refresh', this.onAdminRefresh);
    }

    this.subs.add(
      this.spacesService.spaces$.subscribe((spaces) => {
        this.spaces = spaces;
        this.cdr?.markForCheck();
      }),
    );
    this.subs.add(
      this.spacesService.zones$.subscribe((zones) => {
        if (zones.length > 0) {
          this.zoneOptions = zones.map((z) => z.name);
        }
      }),
    );

    this.loadData();

    if (this.route) {
      this.subs.add(
        this.route.paramMap.subscribe((params) => {
          const id = params.get('id');
          const url = this.router?.url || '';
          if (url.endsWith('/new')) {
            this.openCreateForm();
          } else if (id && url.includes('/edit')) {
            const space = this.spacesService.findById(id);
            if (space) {
              this.openEditForm(space);
            } else {
              this.router?.navigate(['/admin/spaces']);
            }
          } else {
            this.viewMode = 'list';
          }
        }),
      );
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('ken-admin-refresh', this.onAdminRefresh);
    }
    this.subs.unsubscribe();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  private loadData(): void {
    this.loading = true;
    this.spacesService.loadFromApi().subscribe({
      next: () => {
        this.loading = false;
        this.cdr?.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr?.markForCheck();
      },
    });
  }

>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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

<<<<<<< HEAD
  // --- FILTERED & SORTED SPACES ---
=======
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  get filteredSpaces(): SpaceItem[] {
    const q = this.searchQuery.trim().toLowerCase();

    return this.spaces
      .filter((s) => {
<<<<<<< HEAD
        // Search query
=======
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
        const matchesQuery =
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.nameEn.toLowerCase().includes(q) ||
          s.zone.toLowerCase().includes(q);

<<<<<<< HEAD
        // Zone filter
        const matchesZone = this.selectedZone === 'Tất cả' || s.zone === this.selectedZone;

        // Status filter
=======
        const matchesZone = this.selectedZone === 'Tất cả' || s.zone === this.selectedZone;

>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
        let matchesStatus = true;
        if (this.selectedStatus !== 'Tất cả') {
          if (this.selectedStatus === 'Đang hoạt động') matchesStatus = s.status === 'ACTIVE';
          else if (this.selectedStatus === 'Bảo trì') matchesStatus = s.status === 'MAINTENANCE';
<<<<<<< HEAD
          else if (this.selectedStatus === 'Ngừng hoạt động') matchesStatus = s.status === 'INACTIVE';
        }

        // Tab filter
=======
          else if (this.selectedStatus === 'Ngừng hoạt động')
            matchesStatus = s.status === 'INACTIVE';
        }

>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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

<<<<<<< HEAD
  // --- ACTIONS ---
  setTab(tab: 'ALL' | 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE'): void {
    this.activeTab = tab;
=======
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredSpaces.length / this.pageSize));
  }

  get paginatedSpaces(): SpaceItem[] {
    const safePage = Math.min(this.currentPage, this.totalPages);
    const start = (safePage - 1) * this.pageSize;
    return this.filteredSpaces.slice(start, start + this.pageSize);
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const start = Math.max(1, Math.min(this.currentPage - 3, total - 6));
    const end = Math.min(total, start + 6);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  get pageStartIndex(): number {
    if (this.filteredSpaces.length === 0) return 0;
    const safePage = Math.min(this.currentPage, this.totalPages);
    return (safePage - 1) * this.pageSize + 1;
  }

  get pageEndIndex(): number {
    const safePage = Math.min(this.currentPage, this.totalPages);
    return Math.min(this.filteredSpaces.length, safePage * this.pageSize);
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
  }

  setTab(tab: 'ALL' | 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE'): void {
    this.activeTab = tab;
    this.currentPage = 1;
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  }

  toggleSort(): void {
    this.sortAscending = !this.sortAscending;
<<<<<<< HEAD
    this.showToast(`Đã sắp xếp theo tên ${this.sortAscending ? 'A-Z' : 'Z-A'}`);
=======
    this.showToast(`Đã sắp xếp theo tên ${this.sortAscending ? 'A-Z' : 'Z-A'}`, 'info');
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  }

  openCreateForm(): void {
    this.viewMode = 'form';
    this.isEditing = false;
    this.editingId = null;
    this.formData = this.getEmptyForm();
    this.formError = '';
<<<<<<< HEAD
    if (!this.router.url.endsWith('/new')) {
=======
    if (this.router && !this.router.url.endsWith('/new')) {
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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
<<<<<<< HEAD
    };
    this.formError = '';
    const targetUrl = `/admin/spaces/${space.id}/edit`;
    if (this.router.url !== targetUrl) {
=======
      image: this.resolveSpaceImage(space),
    };
    this.formError = '';
    const targetUrl = `/admin/spaces/${space.id}/edit`;
    if (this.router && this.router.url !== targetUrl) {
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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
<<<<<<< HEAD
    this.router.navigate(['/admin/spaces']);
=======
    this.router?.navigate(['/admin/spaces']);
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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
<<<<<<< HEAD
    // Validation
=======
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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
<<<<<<< HEAD
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
=======
    this.saving = true;
    this.spacesService
      .saveSpace(
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
          image: this.formData.image.trim() || undefined,
        },
        this.editingId ?? undefined,
      )
      .subscribe({
        next: () => {
          this.saving = false;
          const actionText = this.isEditing ? 'Cập nhật' : 'Thêm mới';
          this.showToast(`${actionText} không gian "${this.formData.name}" thành công!`);
          this.cancelForm();
        },
        error: (err) => {
          this.saving = false;
          this.formError = err?.error?.message || 'Không thể lưu không gian.';
        },
      });
  }

  requestToggleStatus(space: SpaceItem): void {
    this.confirmToggleTarget = space;
  }

  confirmToggleStatus(): void {
    const space = this.confirmToggleTarget;
    if (!space) return;
    this.confirmToggleTarget = null;
    const willActivate = space.status === 'INACTIVE';

    this.spacesService.toggleStatusApi(space).subscribe({
      next: () => {
        if (willActivate) {
          this.showToast(`Đã kích hoạt lại không gian "${space.name}".`);
        } else {
          this.showToast(
            `Đã chuyển "${space.name}" sang Ngừng hoạt động (bảo toàn lịch sử đặt chỗ).`,
            'info',
          );
        }
      },
      error: (err) => {
        this.showToast(err?.error?.message || 'Không thể thay đổi trạng thái không gian.', 'info');
      },
    });
  }

  exportList(): void {
    if (typeof document === 'undefined') return;
    const headers = [
      'ID',
      'Tên không gian',
      'Tên tiếng Anh',
      'Zone',
      'Hình thức',
      'Buffer (phút)',
      'Sức chứa',
      'Min',
      'Max',
      'Đơn giá',
      'Trạng thái',
    ];
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
    const rows = this.spaces.map((s) => [
      s.id,
      `"${s.name}"`,
      `"${s.nameEn}"`,
      `"${s.zone}"`,
      `"${s.type}"`,
<<<<<<< HEAD
=======
      s.bufferMinutes,
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
      s.capacity,
      s.minGuest,
      s.maxGuest,
      `"${s.priceLabel}"`,
<<<<<<< HEAD
      s.status === 'ACTIVE' ? 'Đang hoạt động' : s.status === 'MAINTENANCE' ? 'Bảo trì' : 'Ngừng hoạt động',
=======
      s.status === 'ACTIVE'
        ? 'Đang hoạt động'
        : s.status === 'MAINTENANCE'
          ? 'Bảo trì'
          : 'Ngừng hoạt động',
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
<<<<<<< HEAD
    link.setAttribute('download', `ken-danh-sach-khong-gian-${new Date().toISOString().slice(0, 10)}.csv`);
=======
    link.setAttribute(
      'download',
      `ken-danh-sach-khong-gian-${new Date().toISOString().slice(0, 10)}.csv`,
    );
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.showToast('Đã xuất danh sách không gian dạng CSV thành công!');
  }

  showToast(message: string, type: 'success' | 'info' = 'success'): void {
    this.toastMessage = message;
    this.toastType = type;
<<<<<<< HEAD
    setTimeout(() => {
      this.toastMessage = null;
    }, 3500);
  }

  private getEmptyForm(): SpaceFormData {
    return {
      zone: 'KÉN Tập Trung',
=======
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMessage = null;
      this.cdr?.markForCheck();
    }, 3500);
  }

  resolveSpaceImage(space?: Partial<SpaceItem> | null): string {
    const raw = space?.image?.trim();
    if (raw) return raw;
    const text = `${space?.name || ''} ${space?.nameEn || ''} ${space?.zone || ''}`.toLowerCase();
    if (text.includes('focus') || text.includes('pod') || text.includes('tập trung cá nhân'))
      return '/images/ken-flow/listing-focus.png';
    if (text.includes('work') || text.includes('cowork') || text.includes('làm việc chung'))
      return '/images/ken-flow/listing-work.png';
    if (text.includes('họp') || text.includes('meeting') || text.includes('boardroom'))
      return '/images/ken-flow/listing-meeting-small.png';
    if (
      text.includes('nghỉ') ||
      text.includes('single') ||
      text.includes('double') ||
      text.includes('private')
    )
      return '/images/ken-flow/listing-single.png';
    return '/images/ken-flow/listing-focus.png';
  }

  private getEmptyForm(): SpaceFormData {
    return {
      zone: this.zoneOptions[0] || 'KÉN Tập Trung',
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
      name: '',
      nameEn: '',
      capacity: 1,
      minGuest: 1,
      maxGuest: 1,
      bookingMode: 'SHARED',
      status: 'ACTIVE',
      amenities: ['WiFi', 'Ổ cắm điện', 'Đặt chỗ trực tuyến'],
<<<<<<< HEAD
=======
      image: this.resolveSpaceImage({ zone: this.zoneOptions[0] || 'KÉN Tập Trung' }),
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
    };
  }
}

export { SpacesComponent as Spaces };
