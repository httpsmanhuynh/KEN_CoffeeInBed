import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface ZoneItem {
  id: string;
  code: string;
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
export class AreasComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly cdr = inject(ChangeDetectorRef, { optional: true });

  viewMode: 'list' | 'form' = 'list';
  formTitle = 'Thêm khu vực';
  isEditing = false;
  editingZoneId: string | null = null;
  loading = false;
  saving = false;
  sortAsc = true;
  currentPage = 1;
  readonly pageSize = 10;
  confirmToggleTarget: ZoneItem | null = null;

  toast: { type: 'success' | 'error' | 'info'; text: string } | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  formData = {
    name: '',
    code: '',
    slug: '',
    description: '',
    status: 'ACTIVE' as 'ACTIVE' | 'HIDDEN',
    canBook: true,
  };

  zones: ZoneItem[] = [
    {
      id: 'z1',
      code: 'KEN_KET_NOI',
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
      code: 'KEN_TAP_TRUNG',
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
      code: 'KEN_TAI_TAO',
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

  private readonly onAdminRefresh = () => {
    this.loadZones();
  };

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('ken-admin-refresh', this.onAdminRefresh);
    }
    this.route?.url.subscribe(() => {
      const path = this.router?.url || '';
      if (path.endsWith('/new')) {
        this.openCreateForm();
      } else {
        this.viewMode = 'list';
      }
    });
    this.loadZones();
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('ken-admin-refresh', this.onAdminRefresh);
    }
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  loadZones(): void {
    if (!this.http) return;
    this.loading = true;
    forkJoin({
      zones: this.http.get<any>('/api/zones?all=true').pipe(catchError(() => of(null))),
      spaces: this.http.get<any>('/api/spaces?all=true').pipe(catchError(() => of(null))),
    }).subscribe((res) => {
      this.loading = false;
      const rawZones = Array.isArray(res.zones) ? res.zones : res.zones?.items || res.zones?.data || [];
      const rawSpaces = Array.isArray(res.spaces) ? res.spaces : res.spaces?.items || res.spaces?.data || [];

      if (rawZones.length > 0 || res.zones !== null) {
        this.zones = rawZones.map((z: any, idx: number) => {
          const zId = String(z._id || z.id);
          const zCode = z.code || '';
          const matchingSpaces = rawSpaces.filter(
            (s: any) => String(s.zone_id || s.zone?._id || '') === zId || (zCode && s.zone_code === zCode)
          );
          const activeSpacesCount = matchingSpaces.filter(
            (s: any) => s.is_active !== false && String(s.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
          ).length;

          const isActive = z.is_active !== false && String(z.status || 'ACTIVE').toUpperCase() !== 'HIDDEN' && String(z.status || 'ACTIVE').toUpperCase() !== 'INACTIVE';
          const canBook = z.is_bookable !== undefined ? Boolean(z.is_bookable) : (z.can_book !== undefined ? Boolean(z.can_book) : (matchingSpaces.length > 0 || !String(zCode).includes('KET_NOI')));

          return {
            id: zId,
            code: zCode || `ZONE_${idx + 1}`,
            name: z.name || z.code || 'Khu vực',
            slug: z.slug || this.toSlug(z.name || 'zone'),
            description: z.description || 'Khu vực chức năng tại KÉN.',
            canBook,
            canBookLabel: canBook ? 'Có thể đặt' : 'Không nhận',
            spacesCount: matchingSpaces.length,
            activeSpacesCount,
            status: isActive ? 'ACTIVE' : 'HIDDEN',
            statusLabel: isActive ? 'Hoạt động' : 'Tạm ẩn',
            tagColorClass: idx % 2 === 1 ? 'tag-brand-dark' : 'tag-brand-gold',
          } as ZoneItem;
        });
      }
      this.cdr?.markForCheck();
    });
  }

  get totalSpaces(): number {
    return this.zones.reduce((sum, z) => sum + z.spacesCount, 0);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.zones.length / this.pageSize));
  }

  get paginatedZones(): ZoneItem[] {
    const safePage = Math.min(this.currentPage, this.totalPages);
    const start = (safePage - 1) * this.pageSize;
    return this.zones.slice(start, start + this.pageSize);
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(this.currentPage - 3, total - 6));
    const end = Math.min(total, start + 6);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  get pageStartIndex(): number {
    if (this.zones.length === 0) return 0;
    const safePage = Math.min(this.currentPage, this.totalPages);
    return (safePage - 1) * this.pageSize + 1;
  }

  get pageEndIndex(): number {
    const safePage = Math.min(this.currentPage, this.totalPages);
    return Math.min(this.zones.length, safePage * this.pageSize);
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
  }

  toggleSort(): void {
    this.sortAsc = !this.sortAsc;
    this.currentPage = 1;
    this.zones = [...this.zones].sort((a, b) =>
      this.sortAsc ? a.name.localeCompare(b.name, 'vi') : b.name.localeCompare(a.name, 'vi')
    );
  }

  openCreateForm(): void {
    this.isEditing = false;
    this.editingZoneId = null;
    this.formTitle = 'Thêm khu vực mới';
    this.formData = {
      name: '',
      code: '',
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
      code: z.code,
      slug: z.slug,
      description: z.description,
      status: z.status,
      canBook: z.canBook,
    };
    this.viewMode = 'form';
  }

  cancelForm(): void {
    this.viewMode = 'list';
    if (this.router?.url.includes('/new')) {
      this.router.navigate(['/admin/zones']);
    }
  }

  saveZone(): void {
    const cleanName = this.formData.name.trim();
    if (!cleanName) {
      this.showToast('error', 'Vui lòng nhập tên khu vực (Zone).');
      return;
    }

    const slug = this.formData.slug.trim() || this.toSlug(cleanName);
    const code = this.formData.code.trim().toUpperCase() || slug.replace(/-/g, '_').toUpperCase();
    const isActive = this.formData.status === 'ACTIVE';

    if (!this.http) {
      if (this.isEditing && this.editingZoneId) {
        const idx = this.zones.findIndex((z) => z.id === this.editingZoneId);
        if (idx !== -1) {
          this.zones[idx] = {
            ...this.zones[idx],
            name: cleanName,
            code,
            slug,
            description: this.formData.description,
            status: this.formData.status,
            statusLabel: isActive ? 'Hoạt động' : 'Tạm ẩn',
            canBook: this.formData.canBook,
            canBookLabel: this.formData.canBook ? 'Có thể đặt' : 'Không nhận',
          };
        }
      } else {
        this.zones.push({
          id: `z${Date.now()}`,
          code,
          name: cleanName,
          slug,
          description: this.formData.description || 'Chưa có mô tả.',
          canBook: this.formData.canBook,
          canBookLabel: this.formData.canBook ? 'Có thể đặt' : 'Không nhận',
          spacesCount: 0,
          activeSpacesCount: 0,
          status: this.formData.status,
          statusLabel: isActive ? 'Hoạt động' : 'Tạm ẩn',
          tagColorClass: 'tag-brand-gold',
        });
      }
      this.showToast('success', `Đã lưu khu vực "${cleanName}".`);
      this.cancelForm();
      return;
    }

    this.saving = true;
    const payload = {
      name: cleanName,
      code,
      slug,
      description: this.formData.description.trim(),
      is_active: isActive,
      is_bookable: this.formData.canBook,
      status: isActive ? 'ACTIVE' : 'INACTIVE',
    };

    const req$ =
      this.isEditing && this.editingZoneId
        ? this.http.patch<any>(`/api/zones/${this.editingZoneId}`, payload)
        : this.http.post<any>('/api/zones', payload);

    req$.subscribe({
      next: () => {
        this.saving = false;
        this.showToast('success', `${this.isEditing ? 'Cập nhật' : 'Tạo mới'} khu vực "${cleanName}" thành công.`);
        this.cancelForm();
        this.loadZones();
      },
      error: (err) => {
        this.saving = false;
        this.showToast('error', err?.error?.message || 'Không thể lưu thông tin khu vực.');
      },
    });
  }

  requestToggleHide(z: ZoneItem): void {
    this.confirmToggleTarget = z;
  }

  confirmToggleHide(): void {
    const z = this.confirmToggleTarget;
    if (!z) return;
    this.confirmToggleTarget = null;
    const nextActive = z.status !== 'ACTIVE';

    if (!this.http) {
      z.status = nextActive ? 'ACTIVE' : 'HIDDEN';
      z.statusLabel = nextActive ? 'Hoạt động' : 'Tạm ẩn';
      this.showToast('info', nextActive ? `Đã kích hoạt khu vực "${z.name}".` : `Đã tạm ẩn khu vực "${z.name}".`);
      return;
    }

    const req$ = nextActive
      ? this.http.patch<any>(`/api/zones/${z.id}`, { is_active: true, status: 'ACTIVE' })
      : this.http.delete<any>(`/api/zones/${z.id}`);

    req$.subscribe({
      next: () => {
        this.showToast('success', nextActive ? `Đã kích hoạt lại "${z.name}".` : `Đã tạm ẩn khu vực "${z.name}" (Soft Delete).`);
        this.loadZones();
      },
      error: (err) => {
        this.showToast('error', err?.error?.message || 'Không thể đổi trạng thái khu vực.');
      },
    });
  }

  exportList(): void {
    if (typeof document === 'undefined') return;
    const header = ['Mã Zone', 'Tên Zone', 'Slug', 'Mô tả', 'Nhận đặt chỗ', 'Số Space', 'Space hoạt động', 'Trạng thái'];
    const rows = this.zones.map((z) => [
      z.code,
      z.name,
      z.slug,
      z.description,
      z.canBookLabel,
      String(z.spacesCount),
      String(z.activeSpacesCount),
      z.statusLabel,
    ]);
    const csv = '\uFEFF' + [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ken-zones-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('success', `Đã xuất ${this.zones.length} khu vực ra CSV.`);
  }

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }

  showToast(type: 'success' | 'error' | 'info', text: string): void {
    this.toast = { type, text };
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast = null;
      this.cdr?.markForCheck();
    }, 4500);
  }
}

export { AreasComponent as Areas };
