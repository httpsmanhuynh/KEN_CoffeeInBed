import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AddonAvailability, AddonsService, ProductAddon, ProductCategory, ProductStatus } from './addons.service';

interface AddonFormData {
  id?: string;
  code: string;
  name: string;
  category: ProductCategory;
  price: number;
  unit: string;
  catalogVisible: boolean;
  addonAvailable: AddonAvailability;
  status: ProductStatus;
  image: string;
}

export const DRINK_SUBSIDY_VND = 50000;

@Component({
  selector: 'app-addons',
  standalone: false,
  styleUrl: './addons.css',
  templateUrl: './addons.html',
})
export class Addons implements OnInit, OnDestroy {
  readonly addonsService = inject(AddonsService);
  private readonly router = inject(Router, { optional: true });
  private readonly cdr = inject(ChangeDetectorRef, { optional: true });
  readonly Math = Math;
  readonly drinkSubsidy = DRINK_SUBSIDY_VND;

  products: ProductAddon[] = [];
  selectedProduct: ProductAddon | null = null;
  isCreating = false;
  loading = false;
  saving = false;

  mainTab: 'MENU' | 'CONFIG' = 'MENU';
  categoryFilterTab: 'ALL' | 'DO_UONG' | 'BANH' | 'TIEN_ICH' = 'ALL';

  searchQuery = '';
  selectedStatusFilter = 'Tất cả';
  selectedCategoryFilter = 'Tất cả';

  currentPage = 1;
  drinkPage = 1;
  readonly pageSize = 10;

  formData: AddonFormData = this.emptyForm();
  formError = '';

  toastMessage: string | null = null;
  toastType: 'success' | 'info' = 'success';
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private subs = new Subscription();

  readonly categoryOptions: ProductCategory[] = ['Đồ uống', 'Bánh / Ăn nhẹ', 'Tiện ích'];
  readonly unitOptions = ['Ly', 'Phần', 'Chai', 'Giờ', 'Lượt', 'Cái', 'Bộ'];
  readonly availabilityOptions: AddonAvailability[] = ['Khả dụng', 'Hết hàng', 'Không khả dụng'];

  private readonly onAdminRefresh = () => {
    this.loadData();
  };

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('ken-admin-refresh', this.onAdminRefresh);
    }
    this.subs.add(
      this.addonsService.addons$.subscribe((items) => {
        this.products = items;
        if (!this.isCreating) {
          if (!this.selectedProduct && items.length > 0) {
            const defaultSelected = items.find((p) => p.code === 'DU-06' || p.name.includes('Matcha')) ?? items[0];
            this.selectProduct(defaultSelected);
          } else if (this.selectedProduct) {
            const updated = this.addonsService.findById(this.selectedProduct.id);
            if (updated) this.selectedProduct = updated;
          }
        }
        this.cdr?.markForCheck();
      })
    );
    this.loadData();
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
    this.addonsService.loadFromApi().subscribe({
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

  get totalCount(): number {
    return this.products.length;
  }

  get doUongCount(): number {
    return this.products.filter((p) => p.category === 'Đồ uống').length;
  }

  get banhCount(): number {
    return this.products.filter((p) => p.category === 'Bánh / Ăn nhẹ').length;
  }

  get tienIchCount(): number {
    return this.products.filter((p) => p.category === 'Tiện ích').length;
  }

  get drinkProducts(): ProductAddon[] {
    return this.products.filter((p) => p.category === 'Đồ uống');
  }

  get filteredProducts(): ProductAddon[] {
    const q = this.searchQuery.trim().toLowerCase();

    return this.products.filter((p) => {
      const matchesQuery =
        !q ||
        p.id.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);

      let matchesStatus = true;
      if (this.selectedStatusFilter === 'Đang bán') {
        matchesStatus = p.status === 'ACTIVE';
      } else if (this.selectedStatusFilter === 'Tạm ngưng') {
        matchesStatus = p.status === 'PAUSED';
      } else if (this.selectedStatusFilter === 'Hết hàng') {
        matchesStatus = p.addonAvailable === 'Hết hàng';
      }

      const matchesCategoryDropdown =
        this.selectedCategoryFilter === 'Tất cả' || p.category === this.selectedCategoryFilter;

      let matchesTab = true;
      if (this.categoryFilterTab === 'DO_UONG') matchesTab = p.category === 'Đồ uống';
      else if (this.categoryFilterTab === 'BANH') matchesTab = p.category === 'Bánh / Ăn nhẹ';
      else if (this.categoryFilterTab === 'TIEN_ICH') matchesTab = p.category === 'Tiện ích';

      return matchesQuery && matchesStatus && matchesCategoryDropdown && matchesTab;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredProducts.length / this.pageSize));
  }

  get paginatedProducts(): ProductAddon[] {
    const safePage = Math.min(this.currentPage, this.totalPages);
    const start = (safePage - 1) * this.pageSize;
    return this.filteredProducts.slice(start, start + this.pageSize);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get pageStartIndex(): number {
    if (this.filteredProducts.length === 0) return 0;
    const safePage = Math.min(this.currentPage, this.totalPages);
    return (safePage - 1) * this.pageSize + 1;
  }

  get pageEndIndex(): number {
    const safePage = Math.min(this.currentPage, this.totalPages);
    return Math.min(this.filteredProducts.length, safePage * this.pageSize);
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
  }

  get drinkTotalPages(): number {
    return Math.max(1, Math.ceil(this.drinkProducts.length / this.pageSize));
  }

  get paginatedDrinkProducts(): ProductAddon[] {
    const safe = Math.min(this.drinkPage, this.drinkTotalPages);
    const start = (safe - 1) * this.pageSize;
    return this.drinkProducts.slice(start, start + this.pageSize);
  }

  get drinkPageNumbers(): number[] {
    return Array.from({ length: this.drinkTotalPages }, (_, i) => i + 1);
  }

  goToDrinkPage(p: number): void {
    if (p < 1 || p > this.drinkTotalPages) return;
    this.drinkPage = p;
  }

  selectProduct(product: ProductAddon, scrollToEditor = false): void {
    this.selectedProduct = product;
    this.isCreating = false;
    this.formData = {
      id: product.id,
      code: product.code,
      name: product.name,
      category: product.category,
      price: product.price,
      unit: product.unit,
      catalogVisible: product.catalogVisible,
      addonAvailable: product.addonAvailable,
      status: product.status,
      image: product.image,
    };
    this.formError = '';
    if (scrollToEditor && typeof document !== 'undefined') {
      setTimeout(() => {
        document.getElementById('addon-editor-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
    }
  }

  openCreateForm(): void {
    this.mainTab = 'MENU';
    this.isCreating = true;
    this.selectedProduct = null;
    this.formData = this.emptyForm();
    this.formError = '';
    if (typeof document !== 'undefined') {
      setTimeout(() => {
        document.getElementById('addon-editor-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
    }
  }

  cancelForm(): void {
    this.isCreating = false;
    if (this.products.length > 0) {
      this.selectProduct(this.products[0]);
    }
  }

  saveProduct(): void {
    if (!this.formData.name.trim()) {
      this.formError = 'Vui lòng nhập tên sản phẩm / tiện ích.';
      return;
    }
    if (Number(this.formData.price) < 0 || !Number.isFinite(Number(this.formData.price))) {
      this.formError = 'Giá bán phải là số không âm.';
      return;
    }

    let defaultImg = this.formData.image.trim();
    if (!defaultImg) {
      if (this.formData.category === 'Đồ uống') defaultImg = '/images/addons/cf-den.png';
      else if (this.formData.category === 'Bánh / Ăn nhẹ') defaultImg = '/images/addons/bake-croissant.png';
      else defaultImg = '/images/addons/eq-monitor.png';
    }

    this.saving = true;
    this.addonsService
      .saveApi(
        {
          code: this.formData.code.trim().toUpperCase(),
          name: this.formData.name.trim(),
          category: this.formData.category,
          price: Math.round(Number(this.formData.price)),
          unit: this.formData.unit || 'Ly',
          catalogVisible: this.formData.catalogVisible,
          addonAvailable: this.formData.addonAvailable,
          status: this.formData.status,
          image: defaultImg,
        },
        this.isCreating ? undefined : this.selectedProduct ?? undefined
      )
      .subscribe({
        next: (saved) => {
          this.saving = false;
          const actionText = this.isCreating ? 'Thêm mới' : 'Cập nhật';
          this.showToast(`${actionText} sản phẩm "${saved.name}" thành công!`);
          this.selectProduct(saved);
        },
        error: (err) => {
          this.saving = false;
          this.formError = err?.error?.message || 'Không thể lưu sản phẩm.';
        },
      });
  }

  toggleProductStatus(product: ProductAddon, event?: Event): void {
    event?.stopPropagation();
    this.addonsService.toggleStatusApi(product).subscribe({
      next: () => {
        const nextStatus: ProductStatus = product.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        product.status = nextStatus;
        if (this.selectedProduct?.id === product.id) {
          this.formData.status = nextStatus;
        }
        this.showToast(
          `Đã ${nextStatus === 'ACTIVE' ? 'mở bán lại' : 'tạm ngưng'} sản phẩm "${product.name}"`
        );
      },
      error: (err) => {
        this.showToast(err?.error?.message || 'Không thể đổi trạng thái sản phẩm.', 'info');
      },
    });
  }

  setCategoryTab(tab: 'ALL' | 'DO_UONG' | 'BANH' | 'TIEN_ICH'): void {
    this.categoryFilterTab = tab;
    this.currentPage = 1;
  }

  drinkSurcharge(price: number): number {
    return Math.max(0, Number(price || 0) - DRINK_SUBSIDY_VND);
  }

  goToPackages(): void {
    this.router?.navigate(['/admin/packages']);
  }

  exportCsv(): void {
    if (typeof document === 'undefined') return;
    const headers = ['Mã SP', 'Tên sản phẩm', 'Nhóm', 'Đơn vị', 'Giá (VND)', 'Catalog', 'Khả dụng', 'Trạng thái'];
    const rows = this.filteredProducts.map((p) => [
      p.code,
      p.name,
      p.category,
      p.unit,
      String(p.price),
      p.catalogVisible ? 'Hiển thị' : 'Ẩn',
      p.addonAvailable,
      p.status,
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ken-products-addons-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    this.showToast(`Đã xuất ${this.filteredProducts.length} sản phẩm ra CSV.`);
  }

  formatPrice(price: number): string {
    return `${Math.round(price || 0).toLocaleString('vi-VN')}đ`;
  }

  showToast(message: string, type: 'success' | 'info' = 'success'): void {
    this.toastMessage = message;
    this.toastType = type;
    this.cdr?.markForCheck();
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMessage = null;
      this.cdr?.markForCheck();
    }, 3500);
  }

  private emptyForm(): AddonFormData {
    return {
      code: '',
      name: '',
      category: 'Đồ uống',
      price: 45000,
      unit: 'Ly',
      catalogVisible: true,
      addonAvailable: 'Khả dụng',
      status: 'ACTIVE',
      image: '/images/addons/cf-den.png',
    };
  }
}
