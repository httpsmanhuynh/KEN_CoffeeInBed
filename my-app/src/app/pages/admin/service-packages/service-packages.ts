import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PackageStatus, PackageType, PackageUnit, ServicePackage, ServicePackagesService } from './service-packages.service';

type ViewMode = 'list' | 'detail' | 'form';

interface PackageFormData {
  name: string;
  shortName: string;
  group: 'KÉN Tập Trung' | 'KÉN Tái Tạo';
  type: PackageType;
  unit: PackageUnit;
  duration: string;
  price: number;
  space: string;
  inclusion: string;
  status: PackageStatus;
}

@Component({
  selector: 'app-service-packages',
  standalone: false,
  styleUrl: './service-packages.css',
  templateUrl: './service-packages.html',
})
export class ServicePackages implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly service = inject(ServicePackagesService);

  packages: ServicePackage[] = [];
  viewMode: ViewMode = 'list';
  selectedPackage: ServicePackage | null = null;
  editingId: string | null = null;

  // Filter criteria
  query = '';
  selectedGroup = 'Tất cả';
  selectedSpace = 'Tất cả';
  selectedType = 'Tất cả';
  selectedUnit = 'Tất cả';
  selectedStatus = 'Tất cả';
  sortKey: 'id' | 'price' | 'name' = 'id';
  sortAsc = true;

  // Form model
  formData: PackageFormData = this.emptyForm();
  formError = '';

  // Toast
  toastMessage: string | null = null;
  toastType: 'success' | 'info' = 'success';

  readonly packageGroups: Array<'KÉN Tập Trung' | 'KÉN Tái Tạo'> = ['KÉN Tập Trung', 'KÉN Tái Tạo'];

  readonly spaceOptions = [
    'Work Lounge',
    'Focus Pod',
    'Small Meeting Room',
    'Boardroom',
    'Single / Double / Studio',
  ];

  ngOnInit(): void {
    this.service.packages$.subscribe((items) => {
      this.packages = items;
      if (this.selectedPackage) {
        this.selectedPackage = this.service.findById(this.selectedPackage.id) ?? null;
      }
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      const url = this.router.url;

      if (url.endsWith('/new')) {
        this.openCreateForm(false);
      } else if (url.includes('/edit') && id) {
        const item = this.service.findById(id);
        if (item) {
          this.openEditForm(item, false);
        } else {
          this.router.navigate(['/admin/packages']);
        }
      } else if (id) {
        const item = this.service.findById(id);
        if (item) {
          this.openDetail(item, false);
        } else {
          this.router.navigate(['/admin/packages']);
        }
      } else {
        this.viewMode = 'list';
        this.selectedPackage = null;
        this.editingId = null;
      }
    });
  }

  // --- STATS COMPUTATIONS ---
  get totalCount(): number {
    return this.packages.length;
  }

  get activeCount(): number {
    return this.packages.filter((item) => item.status === 'ACTIVE').length;
  }

  get inactiveCount(): number {
    return this.packages.filter((item) => item.status === 'INACTIVE').length;
  }

  get tapTrungCount(): number {
    return this.packages.filter((item) => item.group === 'KÉN Tập Trung').length;
  }

  get taiTaoCount(): number {
    return this.packages.filter((item) => item.group === 'KÉN Tái Tạo').length;
  }

  // --- FILTER & SORT ---
  get filteredPackages(): ServicePackage[] {
    const search = this.query.trim().toLowerCase();

    return this.packages
      .filter((item) => {
        const matchesQuery =
          !search ||
          `${item.id} ${item.name} ${item.shortName} ${item.space}`.toLowerCase().includes(search);

        const matchesGroup = this.selectedGroup === 'Tất cả' || item.group === this.selectedGroup;
        const matchesSpace = this.selectedSpace === 'Tất cả' || item.space === this.selectedSpace;
        const matchesType = this.selectedType === 'Tất cả' || item.type === this.selectedType;
        const matchesUnit = this.selectedUnit === 'Tất cả' || item.unit === this.selectedUnit;
        const matchesStatus =
          this.selectedStatus === 'Tất cả' || item.status === this.selectedStatus;

        return matchesQuery && matchesGroup && matchesSpace && matchesType && matchesUnit && matchesStatus;
      })
      .sort((a, b) => {
        const order = this.sortAsc ? 1 : -1;
        if (this.sortKey === 'price') {
          return (a.price - b.price) * order;
        }
        if (this.sortKey === 'name') {
          return a.name.localeCompare(b.name, 'vi') * order;
        }
        return a.id.localeCompare(b.id) * order;
      });
  }

  groupItems(group: 'KÉN Tập Trung' | 'KÉN Tái Tạo'): ServicePackage[] {
    return this.filteredPackages.filter((item) => item.group === group);
  }

  toggleSort(key: 'id' | 'price' | 'name'): void {
    if (this.sortKey === key) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortKey = key;
      this.sortAsc = true;
    }
    const label = key === 'price' ? 'giá' : key === 'name' ? 'tên' : 'mã';
    this.showToast(`Đã sắp xếp theo ${label} (${this.sortAsc ? 'tăng dần' : 'giảm dần'})`);
  }

  // --- NAVIGATION & ACTIONS ---
  openDetail(item: ServicePackage, navigate = true): void {
    this.viewMode = 'detail';
    this.selectedPackage = item;
    if (navigate) {
      this.router.navigate(['/admin/packages', item.id]);
    }
  }

  openCreateForm(navigate = true): void {
    this.viewMode = 'form';
    this.editingId = null;
    this.formData = this.emptyForm();
    this.formError = '';
    if (navigate) {
      this.router.navigate(['/admin/packages/new']);
    }
  }

  openEditForm(item: ServicePackage, navigate = true): void {
    this.viewMode = 'form';
    this.editingId = item.id;
    this.formData = {
      name: item.name,
      shortName: item.shortName,
      group: item.group,
      type: item.type,
      unit: item.unit,
      duration: item.duration,
      price: item.price,
      space: item.space,
      inclusion: item.inclusion,
      status: item.status,
    };
    this.formError = '';
    if (navigate) {
      this.router.navigate(['/admin/packages', item.id, 'edit']);
    }
  }

  cancelForm(): void {
    if (this.editingId && this.service.findById(this.editingId)) {
      this.router.navigate(['/admin/packages', this.editingId]);
    } else {
      this.router.navigate(['/admin/packages']);
    }
  }

  savePackage(): void {
    if (!this.formData.name.trim()) {
      this.formError = 'Vui lòng nhập tên gói dịch vụ.';
      return;
    }
    if (!this.formData.space.trim()) {
      this.formError = 'Vui lòng chọn loại không gian áp dụng.';
      return;
    }
    if (!this.formData.duration.trim()) {
      this.formError = 'Vui lòng nhập thời lượng sử dụng (VD: 1 giờ, 4 giờ, 08:00–22:00).';
      return;
    }
    if (this.formData.price < 0) {
      this.formError = 'Giá gói phải là số không âm.';
      return;
    }

    const saved = this.service.save(
      {
        ...this.formData,
        name: this.formData.name.trim(),
        shortName: this.formData.space.trim(),
        space: this.formData.space.trim(),
        duration: this.formData.duration.trim(),
        inclusion: this.formData.inclusion.trim(),
      },
      this.editingId ?? undefined
    );

    const actionText = this.editingId ? 'Cập nhật' : 'Thêm mới';
    this.showToast(`${actionText} gói ${saved.id} · "${saved.name}" thành công!`);
    this.router.navigate(['/admin/packages', saved.id]);
  }

  duplicate(item: ServicePackage): void {
    const copy = this.service.duplicate(item);
    this.showToast(`Đã nhân bản gói ${item.id} thành gói mới ${copy.id}!`);
    this.openEditForm(copy);
  }

  duplicateCurrent(): void {
    if (!this.editingId) return;
    const item = this.service.findById(this.editingId);
    if (item) {
      this.duplicate(item);
    }
  }

  toggleStatus(item: ServicePackage): void {
    this.service.toggleStatus(item.id);
    const updated = this.service.findById(item.id);
    this.selectedPackage = updated ?? null;
    const statusText = updated?.status === 'ACTIVE' ? 'Kích hoạt' : 'Tạm ngưng';
    this.showToast(`Đã ${statusText} gói ${item.id} · ${item.name}`);
  }

  // Helper labels and formatting
  formatPrice(price: number): string {
    return `${price.toLocaleString('vi-VN')}đ`;
  }

  priceLabel(item: ServicePackage): string {
    const price = this.formatPrice(item.price);
    if (item.unit === 'PER_PERSON') {
      return `${price}/người/${item.type === 'HOURLY' ? 'giờ' : 'gói'}`;
    }
    return `${price}/${item.type === 'HOURLY' ? 'giờ' : 'gói'}`;
  }

  priceLines(item: ServicePackage): string[] {
    return item.inclusion.split(' · ').filter((line) => line.length > 0);
  }

  typeLabel(type: PackageType): string {
    return type === 'FIXED' ? 'FIXED' : 'HOURLY';
  }

  unitLabel(unit: PackageUnit): string {
    return unit === 'PER_SPACE' ? 'PER_SPACE' : 'PER_PERSON';
  }

  statusLabel(status: PackageStatus): string {
    return status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng hoạt động';
  }

  imagePath(item: ServicePackage): string {
    if (item.space === 'Focus Pod') return '/images/ken-flow/listing-focus.png';
    if (item.space === 'Work Lounge') return '/images/ken-flow/listing-work.png';
    if (item.space === 'Small Meeting Room' || item.space === 'Boardroom') {
      return '/images/ken-flow/listing-meeting-small.png';
    }
    return '/images/ken-flow/listing-single.png';
  }

  benefitTitle(item: ServicePackage): string {
    if (item.space === 'Focus Pod') return '01 đồ uống · Hỗ trợ tối đa 50.000đ';
    if (item.space === 'Work Lounge') return '01 đồ uống · Không gian làm việc';
    if (item.space === 'Small Meeting Room' || item.space === 'Boardroom') {
      return '01 đồ uống · Tiện ích phòng họp';
    }
    return 'Quyền lợi theo loại phòng';
  }

  showToast(message: string, type: 'success' | 'info' = 'success'): void {
    this.toastMessage = message;
    this.toastType = type;
    setTimeout(() => {
      this.toastMessage = null;
    }, 3500);
  }

  private emptyForm(): PackageFormData {
    return {
      name: '',
      shortName: 'Work Lounge',
      group: 'KÉN Tập Trung',
      type: 'FIXED',
      unit: 'PER_SPACE',
      duration: '1 giờ',
      price: 50000,
      space: 'Work Lounge',
      inclusion: '01 đồ uống · Dùng không gian Work Lounge',
      status: 'ACTIVE',
    };
  }
}
