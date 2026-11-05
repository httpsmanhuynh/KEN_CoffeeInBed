import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

interface FAQItem {
  question: string;
  answer: string;
  isOpen: boolean;
}

interface SupportCategory {
  name: string;
  iconId: string;
}

@Component({
  selector: 'app-support',
  standalone: false,
  templateUrl: './support.component.html',
  styleUrl: './support.component.css',
})
export class SupportComponent implements OnInit {
  searchQuery = '';
  selectedFileName = '';

  faqItems: FAQItem[] = [
    {
      question: 'KÉN Tập Trung có những không gian nào?',
      answer:
        'KÉN Tập Trung cung cấp nhiều loại không gian: phòng làm việc cá nhân, phòng nhóm 4–8 người, phòng họp có màn chiếu, và khu vực mở coworking. Mỗi không gian đều được trang bị Wi-Fi tốc độ cao, ổ cắm điện và điều hòa.',
      isOpen: false,
    },
    {
      question: 'Điều kiện hủy hoặc đổi lịch đặt chỗ là gì?',
      answer:
        'Bạn có thể hủy hoặc đổi lịch miễn phí trước 2 giờ so với giờ đặt. Sau thời hạn này, phí hủy sẽ bằng 50% giá trị buổi đặt. Thao tác hủy hoặc đổi lịch được thực hiện trong mục Đặt chỗ của tài khoản.',
      isOpen: false,
    },
    {
      question: 'KÉN ĐIỂM và KÉN Coins khác nhau như thế nào?',
      answer:
        'KÉN ĐIỂM là điểm tích lũy từ mỗi lần sử dụng dịch vụ, dùng để nâng hạng thành viên. KÉN Coins là đơn vị tiền ảo nạp vào tài khoản, dùng để thanh toán trực tiếp cho các dịch vụ tại KÉN.',
      isOpen: false,
    },
    {
      question: 'Không gian KÉN có yên tĩnh và đủ tiện ích không?',
      answer:
        'Tất cả không gian KÉN đều được cách âm tốt và tuân thủ nội quy giữ yên lặng. Tiện ích bao gồm: Wi-Fi tốc độ cao, máy in, nước uống miễn phí, tủ khóa cá nhân và khu vực nghỉ ngơi.',
      isOpen: false,
    },
    {
      question: 'Thanh toán thất bại hoặc bị trừ tiền hai lần?',
      answer:
        'Nếu thanh toán thất bại, hãy kiểm tra số dư và thử lại. Trường hợp bị trừ tiền hai lần, hệ thống sẽ tự động hoàn tiền trong 5–7 ngày làm việc. Nếu chưa nhận được, vui lòng liên hệ hotline 1900 123 456.',
      isOpen: false,
    },
    {
      question: 'Làm sao để bảo mật tài khoản KÉN của tôi?',
      answer:
        'Hãy sử dụng mật khẩu mạnh, bật xác thực hai yếu tố (2FA) trong phần Cài đặt tài khoản và không chia sẻ thông tin đăng nhập. Nếu nghi ngờ tài khoản bị xâm nhập, đổi mật khẩu ngay và liên hệ bộ phận hỗ trợ.',
      isOpen: false,
    },
  ];

  categories: SupportCategory[] = [
    { name: 'Thông tin chung', iconId: 'info' },
    { name: 'Đặt chỗ & Lịch', iconId: 'calendar' },
    { name: 'KÉN Tập Trung', iconId: 'focus' },
    { name: 'KÉN Kết Nối', iconId: 'connect' },
    { name: 'KÉN Tái Tạo', iconId: 'spa' },
    { name: 'Hủy & Đổi lịch', iconId: 'reschedule' },
    { name: 'Thanh toán', iconId: 'payment' },
    { name: 'KÉN ĐIỂM\n& KÉN Coins', iconId: 'coins' },
    { name: 'Tài khoản &\nbảo mật', iconId: 'security' },
  ];

  formCategories: string[] = [
    'Thông tin chung',
    'Đặt chỗ & Lịch',
    'KÉN Tập Trung',
    'KÉN Kết Nối',
    'KÉN Tái Tạo',
    'Hủy & Đổi lịch',
    'Thanh toán',
    'KÉN ĐIỂM & KÉN Coins',
    'Tài khoản & bảo mật',
  ];

  supportForm!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.supportForm = this.fb.group({
      fullName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      category: ['', [Validators.required]],
      title: ['', [Validators.required]],
      content: ['', [Validators.required, Validators.minLength(10)]],
    });
  }

  get filteredFAQ(): FAQItem[] {
    if (!this.searchQuery.trim()) {
      return this.faqItems;
    }
    const query = this.searchQuery.toLowerCase().trim();
    return this.faqItems.filter(
      (item) =>
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query),
    );
  }

  toggleFAQ(item: FAQItem): void {
    item.isOpen = !item.isOpen;
  }

  onSearchInput(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFileName = input.files[0].name;
    }
  }

  onSubmit(): void {
    if (this.supportForm.invalid) {
      this.supportForm.markAllAsTouched();
      return;
    }
    /* API gửi yêu cầu hỗ trợ chưa có – không giả lập gửi thành công */
  }

  resetForm(): void {
    this.supportForm.reset();
    this.selectedFileName = '';
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.supportForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(fieldName: string): string {
    const field = this.supportForm.get(fieldName);
    if (!field || !field.errors || !field.touched) return '';
    if (field.errors['required']) return 'Trường này là bắt buộc.';
    if (field.errors['email']) return 'Email không hợp lệ.';
    if (field.errors['minlength'])
      return `Tối thiểu ${field.errors['minlength'].requiredLength} ký tự.`;
    return '';
  }
}
