import { Component, OnInit, inject } from '@angular/core';
import { AddonsService, ProductAddon, ProductCategory, AddonAvailability, ProductStatus } from './addons.service';

interface AddonFormData {
  id?: string;
  name: string;
  category: ProductCategory;
  price: number;
  unit: string;
  catalogVisible: boolean;
  addonAvailable: AddonAvailability;
  status: ProductStatus;
  image: string;
}

@Component({
  selector: 'app-addons',
  standalone: false,
  styleUrl: './addons.css',
  templateUrl: './addons.html',
})
export class Addons implements OnInit {
  readonly addonsService = inject(AddonsService);
  readonly Math = Math;

  products: ProductAddon[] = [];
  selectedProduct: ProductAddon | null = null;
  isCreating = false;

  // Tabs
  mainTab: 'MENU' | 'CONFIG' = 'MENU';
  categoryFilterTab: 'ALL' | 'DO_UONG' | 'BANH' | 'TIEN_ICH' = 'ALL';

  // Filters
  searchQuery = '';
  selectedStatusFilter = 'Tất cả';
  selectedCategoryFilter = 'Tất cả';

  // Form model
  formData: AddonFormData = this.emptyForm();
  formError = '';

  // Toast
  toastMessage: string | null = null;
  toastType: 'success' | 'info' = 'success';

  readonly categoryOptions: ProductCategory[] = ['Đồ uống', 'Bánh / Ăn nhẹ', 'Tiện ích'];
  readonly unitOptions = ['Ly', 'Phần', 'Chai', 'Giờ', 'Lượt', 'Cái', 'Bộ'];
  readonly availabilityOptions: AddonAvailability[] = ['Khả dụng', 'Hết hàng', 'Không khả dụng'];

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

  get activeCount(): number {
    return this.products.filter((p) => p.status === 'ACTIVE').length;
  }

  get pausedCount(): number {
    return this.products.filter((p) => p.status === 'PAUSED').length;
  }

  // Filtered products list
  get filteredProducts(): ProductAddon[] {
    const q = this.searchQuery.trim().toLowerCase();

    return this.products.filter((p) => {
      // Query filter
      const matchesQuery =
        !q ||
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);

      // Status filter
      let matchesStatus = true;
      if (this.selectedStatusFilter === 'Đang bán') {
        matchesStatus = p.status === 'ACTIVE';
      } else if (this.selectedStatusFilter === 'Tạm ngưng') {
        matchesStatus = p.status === 'PAUSED';
      } else if (this.selectedStatusFilter === 'Hết hàng') {
        matchesStatus = p.addonAvailable === 'Hết hàng';
      }

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

      return matchesQuery && matchesStatus && matchesCategoryDropdown && matchesTab;
    });
  }

  // Selection & Form handling
  selectProduct(product: ProductAddon): void {
    this.selectedProduct = product;
    this.isCreating = false;
    this.formData = {
      id: product.id,
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
      this.formError = 'Vui lòng nhập tên sản phẩm.';
      return;
    }
    if (this.formData.price < 0) {
      this.formError = 'Giá bán phải là số không âm.';
      return;
    }

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
  }

  setCategoryTab(tab: 'ALL' | 'DO_UONG' | 'BANH' | 'TIEN_ICH'): void {
    this.categoryFilterTab = tab;
  }

  formatPrice(price: number): string {
    return `${price.toLocaleString('vi-VN')}đ`;
  }

  showToast(message: string, type: 'success' | 'info' = 'success'): void {
    this.toastMessage = message;
    this.toastType = type;
    setTimeout(() => {
      this.toastMessage = null;
    }, 3500);
  }

  private emptyForm(): AddonFormData {
    return {
      name: '',
      category: 'Đồ uống',
      price: 45000,
      unit: 'Ly',
      catalogVisible: true,
      addonAvailable: 'Khả dụng',
      status: 'ACTIVE',
      image: 'images/figma/dish-ca-phe-den-sua.png',
    };
  }
}
