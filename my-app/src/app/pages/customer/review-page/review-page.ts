import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { CustomerApiService } from '../../../core/customer-api.service';

interface ReviewBooking {
  rawBookingId?: string;
  label: string;
  date: string;
  code: string;
  time: string;
  amount: string;
  area: string;
  detail: string;
  icon: string;
}

interface RecentReview {
  name: string;
  place: string;
  date: string;
  rating: number;
  content: string;
}

@Component({
  selector: 'app-review-page',
  standalone: false,
  templateUrl: './review-page.html',
  styleUrl: './review-page.css',
})
export class ReviewPage implements OnInit {
  private readonly api = inject(CustomerApiService, { optional: true });
  readonly stars = [1, 2, 3, 4, 5];

  bookings: ReviewBooking[] = [
    {
      label: 'KÉN Kết Nối · Cà phê',
      date: '20/11/2025',
      code: '#KN 20251120',
      time: '09:30 – 11:00',
      amount: '85.000đ',
      area: 'KÉN Kết Nối',
      detail: 'Ghế ngồi · Cà phê · Khu chung',
      icon: '/images/review-icons/coffee.svg',
    },
    {
      label: 'KÉN Tập Trung · Work Lounge',
      date: '08/11/2025',
      code: '#TT 20251108',
      time: '',
      amount: '',
      area: 'KÉN Tập Trung',
      detail: 'Work Lounge',
      icon: '/images/review-icons/laptop.svg',
    },
    {
      label: 'KÉN Tập Trung · Focus Pod',
      date: '15/10/2025',
      code: '#TT 20251015',
      time: '',
      amount: '',
      area: 'KÉN Tập Trung',
      detail: 'Focus Pod',
      icon: '/images/review-icons/headphones.svg',
    },
    {
      label: 'KÉN Tái Tạo · Double Bed Pod',
      date: '01/12/2025',
      code: '#TR 20251201',
      time: '',
      amount: '',
      area: 'KÉN Tái Tạo',
      detail: 'Double Bed Pod',
      icon: '/images/review-icons/moon.svg',
    },
  ];

  recentReviews: RecentReview[] = [
    {
      name: 'Khách minh họa 01',
      place: 'KÉN Kết Nối · Cà phê',
      date: '18/11/2025',
      rating: 4,
      content: 'Không gian cà phê KÉN yên tĩnh và thoải mái. WiFi nhanh, ổ cắm tiện lợi ngay bàn. Cà phê ngon, nhân viên thân thiện. Góc làm việc lý tưởng buổi sáng.',
    },
    {
      name: 'Khách minh họa 02',
      place: 'KÉN Tập Trung · Focus Pod',
      date: '10/11/2025',
      rating: 5,
      content: 'Focus Pod cách âm rất tốt, hoàn toàn không bị phân tâm. Làm được 4 tiếng liên tục mà không thấy mệt. Không gian nhỏ gọn nhưng đủ tiện nghi, đèn đọc sách tốt.',
    },
    {
      name: 'Khách minh họa 03',
      place: 'KÉN Tái Tạo · Single Bed Pod',
      date: '05/11/2025',
      rating: 5,
      content: 'Pod nghỉ ngơi sạch sẽ, giường nệm êm, rèm che sáng tốt. Nghỉ trưa 2 tiếng cực kỳ phục hồi năng lượng. Dịch vụ đặt chỗ online dễ dàng. Sẽ đặt thêm.',
    },
  ];

  selectedBooking = 0;
  rating = 3;
  reviewText = 'Không gian KÉN yên tĩnh, cà phê ngon, WiFi ổn định. Góc ngồi thoải mái, ánh sáng tốt. Sẽ quay lại làm việc ở đây...';
  isPublic = true;
  selectedFiles: File[] = [];
  notice = '';
  moreNotice = false;
  checkingSession = false;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    if (!this.api) return;
    this.api.getReviews().subscribe({
      next: (res) => {
        if (res?.reviews?.length) {
          this.recentReviews = res.reviews.slice(0, 6).map((r) => ({
            name: r.user_name || 'Khách hàng KÉN',
            place: r.space_name || 'Không gian KÉN',
            date: r.created_at ? new Date(r.created_at).toLocaleDateString('vi-VN') : '',
            rating: r.rating,
            content: r.comment || 'Khách hàng đã đánh giá bằng số sao.',
          }));
        }
      },
    });
    this.auth.ensureSession().subscribe({
      next: (user) => {
        if (!user) return;
        this.reviewText = '';
        this.api!.getMyReviews().subscribe({
          next: (myRes) => {
            if (myRes?.pendingReminders?.length) {
              this.bookings = myRes.pendingReminders.map((b) => ({
                rawBookingId: String(b.bookingId || b.booking_id || b._id),
                label: `${b.space_name || 'Không gian KÉN'}`,
                date: b.start_at ? new Date(b.start_at).toLocaleDateString('vi-VN') : '',
                code: `#${b.booking_code}`,
                time: b.start_at && b.end_at
                  ? `${new Date(b.start_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} – ${new Date(b.end_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                  : '',
                amount: b.final_amount ? `${Number(b.final_amount).toLocaleString('vi-VN')}đ` : '',
                area: b.zone_name || 'Đơn đã hoàn thành',
                detail: b.package_name || b.space_name || 'Không gian KÉN',
                icon: '/images/review-icons/laptop.svg',
              }));
              this.selectedBooking = 0;
            } else {
              this.bookings = [];
            }
          },
          error: () => {
            this.bookings = [];
          },
        });
      },
    });
  }

  get booking(): ReviewBooking {
    return this.bookings[this.selectedBooking];
  }

  chooseBooking(index: number): void {
    this.selectedBooking = index;
    this.rating = 3;
    this.reviewText = '';
    this.selectedFiles = [];
    this.notice = '';
  }

  setRating(value: number): void {
    if (value >= 1 && value <= 5) {
      this.rating = value;
      this.notice = '';
    }
  }

  starsFor(value: number): string {
    return '★'.repeat(value) + '☆'.repeat(5 - value);
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.setFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  private setFiles(files: File[]): void {
    if (files.length > 3) {
      this.notice = 'Vui lòng chọn tối đa 3 ảnh.';
      return;
    }

    if (files.some(f => !f.type.startsWith('image/'))) {
      this.notice = 'Chỉ chấp nhận tập tin hình ảnh.';
      return;
    }

    if (files.some(f => f.size >= 2 * 1024 * 1024)) {
      this.notice = 'Mỗi ảnh phải nhỏ hơn 2 MB.';
      return;
    }

    this.selectedFiles = files;
    this.notice = '';
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
  }

  submit(): void {
    if (this.checkingSession) return;
    this.checkingSession = true;
    this.auth.ensureSession().subscribe({
      next: user => {
        this.checkingSession = false;
        if (!user) {
          this.router.navigate(['/login'], { queryParams: { returnUrl: '/reviews' } });
          return;
        }
        this.submitReview();
      },
      error: () => {
        this.checkingSession = false;
        this.router.navigate(['/login'], { queryParams: { returnUrl: '/reviews' } });
      },
    });
  }

  private submitReview(): void {
    if (this.rating < 1 || this.rating > 5) {
      this.notice = 'Vui lòng chọn từ 1 đến 5 sao.';
      return;
    }

    if (this.reviewText.trim().length < 20) {
      this.notice = 'Vui lòng nhập nhận xét tối thiểu 20 ký tự.';
      return;
    }

    if (this.api && this.booking?.rawBookingId) {
      this.api
        .createReview({
          bookingId: this.booking.rawBookingId,
          rating: this.rating,
          comment: this.reviewText.trim(),
        })
        .subscribe({
          next: () => {
            this.notice = 'Cảm ơn bạn! Đánh giá của bạn đã được ghi nhận trên hệ thống.';
            this.bookings = this.bookings.filter((_, idx) => idx !== this.selectedBooking);
            this.selectedBooking = 0;
          },
          error: (err) => {
            this.notice = err.error?.message || 'Không thể gửi đánh giá lúc này.';
          },
        });
      return;
    }

    this.notice =
      'Đã kiểm tra nội dung hợp lệ. Đây là bản demo, đánh giá chưa được gửi hoặc lưu lên hệ thống.';
  }

  showMoreReviews(): void {
    this.moreNotice = !this.moreNotice;
  }
}
