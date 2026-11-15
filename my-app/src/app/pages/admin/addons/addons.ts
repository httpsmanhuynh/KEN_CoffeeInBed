<<<<<<< HEAD
import { Component, OnInit, inject } from '@angular/core';
import { AddonsService, ProductAddon, ProductCategory, AddonAvailability, ProductStatus } from './addons.service';

interface AddonFormData {
  id?: string;
=======
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AddonAvailability, AddonsService, ProductAddon, ProductCategory, ProductStatus } from './addons.service';

interface AddonFormData {
  id?: string;
  code: string;
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  name: string;
  category: ProductCategory;
  price: number;
  unit: string;
  catalogVisible: boolean;
  addonAvailable: AddonAvailability;
  status: ProductStatus;
  image: string;
}

<<<<<<< HEAD
=======
export const DRINK_SUBSIDY_VND = 50000;

>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
@Component({
  selector: 'app-addons',
  standalone: false,
  styleUrl: './addons.css',
  templateUrl: './addons.html',
})
<<<<<<< HEAD
export class Addons implements OnInit {
  readonly addonsService = inject(AddonsService);
  readonly Math = Math;
=======
export class Addons implements OnInit, OnDestroy {
  readonly addonsService = inject(AddonsService);
  private readonly router = inject(Router, { optional: true });
  private readonly cdr = inject(ChangeDetectorRef, { optional: true });
  readonly Math = Math;
  readonly drinkSubsidy = DRINK_SUBSIDY_VND;
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12

  products: ProductAddon[] = [];
  selectedProduct: ProductAddon | null = null;
  isCreating = false;
<<<<<<< HEAD

  // Tabs
  mainTab: 'MENU' | 'CONFIG' = 'MENU';
  categoryFilterTab: 'ALL' | 'DO_UONG' | 'BANH' | 'TIEN_ICH' = 'ALL';

  // Filters
=======
  loading = false;
  saving = false;

  mainTab: 'MENU' | 'CONFIG' = 'MENU';
  categoryFilterTab: 'ALL' | 'DO_UONG' | 'BANH' | 'TIEN_ICH' = 'ALL';

>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  searchQuery = '';
  selectedStatusFilter = 'Tất cả';
  selectedCategoryFilter = 'Tất cả';

<<<<<<< HEAD
  // Form model
  formData: AddonFormData = this.emptyForm();
  formError = '';

  // Toast
  toastMessage: string | null = null;
  toastType: 'success' | 'info' = 'success';
=======
  currentPage = 1;
  readonly pageSize = 10;

  formData: AddonFormData = this.emptyForm();
  formError = '';

  toastMessage: string | null = null;
  toastType: 'success' | 'info' = 'success';
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private subs = new Subscription();
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12

  readonly categoryOptions: ProductCategory[] = ['Đồ uống', 'Bánh / Ăn nhẹ', 'Tiện ích'];
  readonly unitOptions = ['Ly', 'Phần', 'Chai', 'Giờ', 'Lượt', 'Cái', 'Bộ'];
  readonly availabilityOptions: AddonAvailability[] = ['Khả dụng', 'Hết hàng', 'Không khả dụng'];

<<<<<<< HEAD
  ngOnInit(): void {
    this.addonsService.addons$.subscribe((items) => {
      this.products = items;
      if (!this.selectedProduct && items.length > 0) {
        // Mặc định chọn DU-06 Matcha Latte giống thiết kế Figma
        const defaultSelected = items.find((p) => p.id === 'DU-06') ?? items[0];
        this.selectProduct(defaultSelected);
      } else if (this.selectedProduct) {
        const updated = this.addonsService.findById(this.selectedProduct.id);
        if (updated) {
          this.selectedProduct = updated;
        }
      }
    });
  }

  // Stats computations
=======
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

>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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

<<<<<<< HEAD
  get activeCount(): number {
    return this.products.filter((p) => p.status === 'ACTIVE').length;
  }

  get pausedCount(): number {
    return this.products.filter((p) => p.status === 'PAUSED').length;
  }

  // Filtered products list
=======
  get drinkProducts(): ProductAddon[] {
    return this.products.filter((p) => p.category === 'Đồ uống');
  }

>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  get filteredProducts(): ProductAddon[] {
    const q = this.searchQuery.trim().toLowerCase();

    return this.products.filter((p) => {
<<<<<<< HEAD
      // Query filter
      const matchesQuery =
        !q ||
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);

      // Status filter
=======
      const matchesQuery =
        !q ||
        p.id.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);

>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
      let matchesStatus = true;
      if (this.selectedStatusFilter === 'Đang bán') {
        matchesStatus = p.status === 'ACTIVE';
      } else if (this.selectedStatusFilter === 'Tạm ngưng') {
        matchesStatus = p.status === 'PAUSED';
      } else if (this.selectedStatusFilter === 'Hết hàng') {
        matchesStatus = p.addonAvailable === 'Hết hàng';
      }

<<<<<<< HEAD
      // Category filter dropdown
      const matchesCategoryDropdown =
        this.selectedCategoryFilter === 'Tất cả' || p.category === this.selectedCategoryFilter;

      // Category tab filter
      let matchesTab = true;
      if (this.categoryFilterTab === 'DO_UONG') {
        matchesTab = p.category === 'Đồ uống';
      } else if (this.categoryFilterTab === 'BANH') {
        matchesTab = p.category === 'Bánh / Ăn nhẹ';
      } else if (this.categoryFilterTab === 'TIEN_ICH') {
        matchesTab = p.category === 'Tiện ích';
      }
=======
      const matchesCategoryDropdown =
        this.selectedCategoryFilter === 'Tất cả' || p.category === this.selectedCategoryFilter;

      let matchesTab = true;
      if (this.categoryFilterTab === 'DO_UONG') matchesTab = p.category === 'Đồ uống';
      else if (this.categoryFilterTab === 'BANH') matchesTab = p.category === 'Bánh / Ăn nhẹ';
      else if (this.categoryFilterTab === 'TIEN_ICH') matchesTab = p.category === 'Tiện ích';
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12

      return matchesQuery && matchesStatus && matchesCategoryDropdown && matchesTab;
    });
  }

<<<<<<< HEAD
  // Selection & Form handling
=======
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

>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  selectProduct(product: ProductAddon): void {
    this.selectedProduct = product;
    this.isCreating = false;
    this.formData = {
      id: product.id,
<<<<<<< HEAD
=======
      code: product.code,
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
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
  }

  openCreateForm(): void {
<<<<<<< HEAD
=======
    this.mainTab = 'MENU';
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
    this.isCreating = true;
    this.selectedProduct = null;
    this.formData = this.emptyForm();
    this.formError = '';
  }

  cancelForm(): void {
    this.isCreating = false;
    if (this.products.length > 0) {
      this.selectProduct(this.products[0]);
    }
  }

  saveProduct(): void {
    if (!this.formData.name.trim()) {
<<<<<<< HEAD
      this.formError = 'Vui lòng nhập tên sản phẩm.';
      return;
    }
    if (this.formData.price < 0) {
=======
      this.formError = 'Vui lòng nhập tên sản phẩm / tiện ích.';
      return;
    }
    if (Number(this.formData.price) < 0 || !Number.isFinite(Number(this.formData.price))) {
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
      this.formError = 'Giá bán phải là số không âm.';
      return;
    }

<<<<<<< HEAD
    let defaultImg = this.formData.image;
    if (!defaultImg) {
      if (this.formData.category === 'Đồ uống') defaultImg = 'images/figma/dish-ca-phe-den-sua.png';
      else if (this.formData.category === 'Bánh / Ăn nhẹ') defaultImg = 'images/figma/dish-croissant.png';
      else defaultImg = 'images/figma/monitor.svg';
    }

    const saved = this.addonsService.save(
      {
        name: this.formData.name.trim(),
        category: this.formData.category,
        price: Number(this.formData.price),
        unit: this.formData.unit || 'Ly',
        catalogVisible: this.formData.catalogVisible,
        addonAvailable: this.formData.addonAvailable,
        status: this.formData.status,
        image: defaultImg,
      },
      this.isCreating ? undefined : this.formData.id
    );

    const actionText = this.isCreating ? 'Thêm mới' : 'Cập nhật';
    this.showToast(`${actionText} sản phẩm "${saved.name}" thành công!`);
    this.selectProduct(saved);
  }

  toggleProductStatus(product: ProductAddon, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.addonsService.toggleStatus(product.id);
    const updated = this.addonsService.findById(product.id);
    if (updated) {
      if (this.selectedProduct?.id === product.id) {
        this.selectProduct(updated);
      }
      const label = updated.status === 'ACTIVE' ? 'mở bán lại' : 'tạm ngưng';
      this.showToast(`Đã ${label} sản phẩm "${product.name}"`);
    }
=======
    let defaultImg = this.formData.image.trim();
    if (!defaultImg) {
      if (this.formData.category === 'Đồ uống') defaultImg = '/images/figma/dish-ca-phe-den-sua.png';
      else if (this.formData.category === 'Bánh / Ăn nhẹ') defaultImg = '/images/figma/dish-croissant.png';
      else defaultImg = '/images/figma/monitor.svg';
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
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  }

  setCategoryTab(tab: 'ALL' | 'DO_UONG' | 'BANH' | 'TIEN_ICH'): void {
    this.categoryFilterTab = tab;
<<<<<<< HEAD
  }

  formatPrice(price: number): string {
    return `${price.toLocaleString('vi-VN')}đ`;
=======
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
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
  }

  showToast(message: string, type: 'success' | 'info' = 'success'): void {
    this.toastMessage = message;
    this.toastType = type;
<<<<<<< HEAD
    setTimeout(() => {
      this.toastMessage = null;
=======
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMessage = null;
      this.cdr?.markForCheck();
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
    }, 3500);
  }

  private emptyForm(): AddonFormData {
    return {
<<<<<<< HEAD
=======
      code: '',
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
      name: '',
      category: 'Đồ uống',
      price: 45000,
      unit: 'Ly',
      catalogVisible: true,
      addonAvailable: 'Khả dụng',
      status: 'ACTIVE',
<<<<<<< HEAD
      image: 'images/figma/dish-ca-phe-den-sua.png',
=======
      image: '/images/figma/dish-ca-phe-den-sua.png',
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
    };
  }
}
