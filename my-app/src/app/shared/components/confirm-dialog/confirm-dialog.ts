import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type DialogType = 'warning' | 'error' | 'success';

export interface ConfirmDialogConfig {
  type?: DialogType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  styleUrls: ['./confirm-dialog.css'],
  standalone: true,        // Thêm standalone để có thể đưa vào mảng `imports`
  imports: [CommonModule]  // Sửa lỗi NG8002 cho [ngClass] và *ngIf
})
export class ConfirmDialog {
  @Input() isOpen = false;
  @Input() config: ConfirmDialogConfig = {
    type: 'warning',
    title: 'Xác nhận đăng xuất',
    message: 'Bạn có chắc chắn muốn đăng xuất?',
    confirmText: 'Đăng xuất',
    cancelText: 'Hủy'
  };

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  onConfirm(): void {
    this.confirmed.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}