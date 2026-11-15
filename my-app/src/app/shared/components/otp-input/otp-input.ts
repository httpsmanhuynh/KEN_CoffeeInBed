import {
  AfterViewInit, Component, ElementRef, EventEmitter, Input, OnInit, Output, QueryList, ViewChildren,
} from '@angular/core';

/** Ô nhập OTP dùng chung (đăng ký, 2FA, quên mật khẩu, đổi mật khẩu/SĐT…). */
@Component({
  selector: 'app-otp-input',
  standalone: false,
  templateUrl: './otp-input.html',
  styleUrl: './otp-input.css',
})
export class OtpInput implements OnInit, AfterViewInit {
  @Input() length = 6;
  @Input() invalid = false;
  @Input() disabled = false;
  @Input() autofocus = true;
  @Output() changed = new EventEmitter<string>();
  /** Phát ra khi nhập đủ số ký tự. */
  @Output() completed = new EventEmitter<string>();

  @ViewChildren('box') boxes!: QueryList<ElementRef<HTMLInputElement>>;
  digits: string[] = [];

  get slots(): number[] { return Array.from({ length: this.length }, (_, i) => i); }
  get value(): string { return this.digits.join(''); }

  ngOnInit(): void { this.digits = Array(this.length).fill(''); }
  ngAfterViewInit(): void { if (this.autofocus) setTimeout(() => this.focus(0)); }

  focus(i: number): void {
    const el = this.boxes?.toArray()[Math.max(0, Math.min(i, this.length - 1))]?.nativeElement;
    el?.focus();
    el?.select();
  }

  clear(): void {
    this.digits = Array(this.length).fill('');
    this.boxes.forEach((b) => (b.nativeElement.value = ''));
    this.emit();
    this.focus(0);
  }

  onInput(i: number, ev: Event): void {
    const el = ev.target as HTMLInputElement;
    const v = el.value.replace(/\D/g, '');
    if (!v) { this.digits[i] = ''; el.value = ''; this.emit(); return; }
    this.fill(i, v);
  }

  onKeydown(i: number, ev: KeyboardEvent): void {
    if (ev.key === 'Backspace' && !this.digits[i] && i > 0) {
      ev.preventDefault();
      this.digits[i - 1] = '';
      this.boxes.toArray()[i - 1].nativeElement.value = '';
      this.focus(i - 1);
      this.emit();
    } else if (ev.key === 'ArrowLeft' && i > 0) { ev.preventDefault(); this.focus(i - 1); }
    else if (ev.key === 'ArrowRight' && i < this.length - 1) { ev.preventDefault(); this.focus(i + 1); }
  }

  onPaste(i: number, ev: ClipboardEvent): void {
    ev.preventDefault();
    const t = (ev.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
    if (t) this.fill(i, t);
  }

  /** Điền chuỗi số bắt đầu từ ô i (dùng cho gõ, dán, tự điền từ SMS). */
  private fill(start: number, text: string): void {
    const arr = this.boxes.toArray();
    let last = start;
    for (let k = 0; k < text.length && start + k < this.length; k++) {
      this.digits[start + k] = text[k];
      arr[start + k].nativeElement.value = text[k];
      last = start + k;
    }
    this.focus(Math.min(last + 1, this.length - 1));
    this.emit();
  }

  private emit(): void {
    const v = this.value;
    this.changed.emit(v);
    if (v.length === this.length) this.completed.emit(v);
  }
}
