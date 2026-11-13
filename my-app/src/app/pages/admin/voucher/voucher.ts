import { Component } from '@angular/core';

type DiscountType = 'Phần trăm' | 'Số tiền';
type VoucherStatus = 'ACTIVE' | 'PAUSED';

interface VoucherItem {
  code: string;
  description: string;
  type: DiscountType;
  discount: string;
  cap: string;
  minimum: string;
  start: string;
  end: string;
  used: number;
  limit: number;
  status: VoucherStatus;
  area: string;
}

interface VoucherForm {
  code: string;
  description: string;
  type: DiscountType;
  discount: string;
  cap: string;
  minimum: string;
  area: string;
}

@Component({
  selector: 'app-voucher',
  standalone: false,
  styleUrl: './voucher.css',
  templateUrl: './voucher.html',
})
export class Voucher {
  query = '';
  selectedStatus = 'Tất cả';
  selectedArea = 'Tất cả';
  selectedVoucher: VoucherItem;
  toastMessage: string | null = null;

  readonly vouchers: VoucherItem[] = [
    {
      code: 'WELCOME10',
      description: 'Chào bạn mới - giảm 10%',
      type: 'Phần trăm',
      discount: '10%',
      cap: 'Trần 50.000đ',
      minimum: '100.000đ',
      start: '01/10/2026',
      end: '31/12/2026',
      used: 0,
      limit: 100,
      status: 'ACTIVE',
      area: 'Mọi khu vực',
    },
    {
      code: 'GIAM30K',
      description: 'Giảm 30.000đ cho đơn từ 150.000đ',
      type: 'Số tiền',
      discount: '30.000đ',
      cap: '',
      minimum: '150.000đ',
      start: '01/10/2026',
      end: '31/12/2026',
      used: 0,
      limit: 50,
      status: 'ACTIVE',
      area: 'Mọi khu vực',
    },
    {
      code: 'TAITAO20',
      description: 'KÉN Tái Tạo - giảm 20%',
      type: 'Phần trăm',
      discount: '20%',
      cap: 'Trần 100.000đ',
      minimum: '200.000đ',
      start: '01/10/2026',
      end: '31/12/2026',
      used: 0,
      limit: 30,
      status: 'ACTIVE',
      area: 'KÉN Tái Tạo',
    },
  ];

  form: VoucherForm = this.toForm(this.vouchers[0]);

  constructor() {
    this.selectedVoucher = this.vouchers[0];
  }

  get filteredVouchers(): VoucherItem[] {
    const query = this.query.trim().toLowerCase();
    return this.vouchers.filter((voucher) => {
      const matchesQuery =
        !query ||
        voucher.code.toLowerCase().includes(query) ||
        voucher.description.toLowerCase().includes(query);
      const matchesStatus =
        this.selectedStatus === 'Tất cả' ||
        (this.selectedStatus === 'Đang hoạt động' && voucher.status === 'ACTIVE') ||
        (this.selectedStatus === 'Tạm ngưng' && voucher.status === 'PAUSED');
      const matchesArea = this.selectedArea === 'Tất cả' || voucher.area === this.selectedArea;
      return matchesQuery && matchesStatus && matchesArea;
    });
  }

  get activeCount(): number {
    return this.vouchers.filter((voucher) => voucher.status === 'ACTIVE').length;
  }

  selectVoucher(voucher: VoucherItem): void {
    this.selectedVoucher = voucher;
    this.form = this.toForm(voucher);
  }

  toggleStatus(voucher: VoucherItem): void {
    voucher.status = voucher.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    this.selectVoucher(voucher);
    this.showToast(voucher.status === 'ACTIVE' ? 'Đã mở bán voucher' : 'Đã tạm ngưng voucher');
  }

  saveVoucher(): void {
    Object.assign(this.selectedVoucher, {
      code: this.form.code.trim() || this.selectedVoucher.code,
      description: this.form.description.trim(),
      type: this.form.type,
      discount: this.form.discount,
      cap: this.form.cap,
      minimum: this.form.minimum,
      area: this.form.area,
    });
    this.showToast('Đã lưu thay đổi voucher');
  }

  formatUsed(voucher: VoucherItem): string {
    return `${voucher.used} / ${voucher.limit}`;
  }

  private toForm(voucher: VoucherItem): VoucherForm {
    return {
      code: voucher.code,
      description: voucher.description,
      type: voucher.type,
      discount: voucher.discount.replace('%', '').replace(/\./g, ''),
      cap: voucher.cap.replace('Trần ', '').replace('đ', '').replace(/\./g, ''),
      minimum: voucher.minimum.replace('đ', '').replace(/\./g, ''),
      area: voucher.area,
    };
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    window.setTimeout(() => (this.toastMessage = null), 2400);
  }
}
