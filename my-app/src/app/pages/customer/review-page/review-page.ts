import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
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
  bookingCode?: string;
}

interface MySubmittedReview {
  bookingCode: string;
  spaceName: string;
  packageName: string;
  rating: number;
  comment: string;
  date: string;
}

interface SpaceOption {
  id: string;
  name: string;
}

@Component({
  selector: 'app-review-page',
  standalone: false,
  templateUrl: './review-page.html',
  styleUrl: './review-page.css',
})
export class ReviewPage implements OnInit {
  private readonly api = inject(CustomerApiService, { optional: true });
  private readonly cdr = inject(ChangeDetectorRef);
  readonly stars = [1, 2, 3, 4, 5];

  bookings: ReviewBooking[] = [];
  allReviews: RecentReview[] = [];
  recentReviews: RecentReview[] = [];
  mySubmittedReviews: MySubmittedReview[] = [];
  spaceOptions: SpaceOption[] = [];

  visibleCount = 6;
  totalReviews = 0;
  averageRating = 0;
  loadingReviews = false;
  loadingMore = false;
  loadingMyReviews = false;
  submittingReview = false;
  isLoggedIn = false;

  filterRating: 'all' | number = 'all';
  filterSpaceId = 'all';

  selectedBooking = 0;
  rating = 5;
  reviewText = '';
  isPublic = true;
  selectedFiles: File[] = [];
  notice = '';
  checkingSession = false;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    if (!this.api) return;
    this.loadSpaces();
    this.loadReviews();
    this.auth.ensureSession().subscribe({
      next: (user) => {
        this.isLoggedIn = Boolean(user);
        if (!user) {
          this.bookings = [];
          this.mySubmittedReviews = [];
          this.cdr.markForCheck();
          return;
        }
        this.loadMyReviews();
      },
      error: () => {
        this.isLoggedIn = false;
        this.cdr.markForCheck();
      },
    });
  }

  private iconForSpace(spaceName: string): string {
    const s = (spaceName || '').toLocaleLowerCase('vi-VN');
    if (s.includes('tập trung') || s.includes('focus')) return '/images/review-icons/headphones.svg';
    if (s.includes('nghỉ') || s.includes('tái tạo') || s.includes('riêng tư')) return '/images/review-icons/moon.svg';
    if (s.includes('kết nối') || s.includes('cà phê') || s.includes('café')) return '/images/review-icons/coffee.svg';
    return '/images/review-icons/laptop.svg';
  }

  private mapRecentReview(r: any): RecentReview {
    const spaceName = r.space_name || 'Không gian KÉN';
    const place = r.package_name ? `${spaceName} · ${r.package_name}` : spaceName;
    return {
      name: r.user_name || r.reviewer_name || 'Khách hàng KÉN',
      place,
      date: r.created_at ? new Date(r.created_at).toLocaleDateString('vi-VN') : '',
      rating: Number(r.rating) || 5,
      content: r.comment || 'Khách hàng đã đánh giá bằng số sao.',
      bookingCode: r.booking_code || '',
    };
  }

  private loadSpaces(): void {
    if (!this.api) return;
    this.api.getSpaces().subscribe({
      next: (spaces) => {
        this.spaceOptions = (spaces || [])
          .filter((s) => s?._id && s?.name)
          .map((s) => ({ id: String(s._id), name: String(s.name) }));
        this.cdr.markForCheck();
      },
      error: () => {},
    });
  }

  loadReviews(reset = true): void {
    if (!this.api) return;
    if (reset) {
      this.loadingReviews = true;
      this.visibleCount = 6;
    } else {
      this.loadingMore = true;
    }

    const query: Record<string, string> = {
      limit: '48',
      skip: reset ? '0' : String(this.allReviews.length),
    };
    if (this.filterRating !== 'all') {
      query['rating'] = String(this.filterRating);
    }
    if (this.filterSpaceId && this.filterSpaceId !== 'all') {
      query['spaceId'] = this.filterSpaceId;
    }

    this.api.getReviews(query).subscribe({
      next: (res) => {
        const mapped = (res?.reviews || []).map((r: any) => this.mapRecentReview(r));
        this.totalReviews = Number(res?.totalReviews ?? mapped.length);
        this.averageRating = Number(res?.averageRating ?? 0);
        if (reset) {
          this.allReviews = mapped;
        } else {
          this.allReviews = [...this.allReviews, ...mapped];
          this.visibleCount = Math.min(this.allReviews.length, this.visibleCount + 6);
        }
        this.recentReviews = this.allReviews.slice(0, this.visibleCount);
        this.loadingReviews = false;
        this.loadingMore = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingReviews = false;
        this.loadingMore = false;
        this.cdr.markForCheck();
      },
    });
  }

  loadMyReviews(): void {
    if (!this.api) return;
    this.loadingMyReviews = true;
    this.api.getMyReviews().subscribe({
      next: (myRes) => {
        this.loadingMyReviews = false;
        if (myRes?.pendingReminders?.length) {
          this.bookings = myRes.pendingReminders.map((b: any) => ({
            rawBookingId: String(b.bookingId || b.booking_id || b._id),
            label: `${b.space_name || 'Không gian KÉN'}`,
            date: b.start_at ? new Date(b.start_at).toLocaleDateString('vi-VN') : '',
            code: `#${b.booking_code}`,
            time:
              b.start_at && b.end_at
                ? `${new Date(b.start_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} – ${new Date(b.end_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                : '',
            amount: b.final_amount ? `${Number(b.final_amount).toLocaleString('vi-VN')}đ` : '',
            area: b.zone_name || 'Đã hoàn thành (Check-out)',
            detail: b.package_name || b.space_name || 'Không gian KÉN',
            icon: this.iconForSpace(b.space_name),
          }));
          this.selectedBooking = 0;
        } else {
          this.bookings = [];
        }

        this.mySubmittedReviews = (myRes?.reviews || []).map((r: any) => ({
          bookingCode: r.booking_code ? `#${r.booking_code}` : '',
          spaceName: r.space_name || 'Không gian KÉN',
          packageName: r.package_name || '',
          rating: Number(r.rating) || 5,
          comment: r.comment || 'Bạn đã đánh giá bằng số sao.',
          date: r.created_at ? new Date(r.created_at).toLocaleDateString('vi-VN') : '',
        }));
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingMyReviews = false;
        this.bookings = [];
        this.mySubmittedReviews = [];
        this.cdr.markForCheck();
      },
    });
  }

  get booking(): ReviewBooking {
    return this.bookings[this.selectedBooking];
  }

  get formattedAverage(): string {
    return this.averageRating.toFixed(1);
  }

  get formattedTotalReviews(): string {
    return this.totalReviews.toLocaleString('vi-VN');
  }

  get hasMoreReviews(): boolean {
    return this.visibleCount < this.allReviews.length || this.allReviews.length < this.totalReviews;
  }

  get canCollapseReviews(): boolean {
    return !this.hasMoreReviews && this.allReviews.length > 6;
  }

  setRatingFilter(val: 'all' | number): void {
    this.filterRating = val;
    this.loadReviews(true);
  }

  onSpaceFilterChange(): void {
    this.loadReviews(true);
  }

  chooseBooking(index: number): void {
    this.selectedBooking = index;
    this.rating = 5;
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
    if (this.checkingSession || this.submittingReview) return;
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

    const trimmed = this.reviewText.trim();
    if (trimmed.length > 500) {
      this.notice = 'Nhận xét tối đa 500 ký tự.';
      return;
    }

    if (this.api && this.booking?.rawBookingId) {
      this.submittingReview = true;
      this.api
        .createReview({
          bookingId: this.booking.rawBookingId,
          rating: this.rating,
          comment: trimmed || undefined,
        })
        .subscribe({
          next: () => {
            this.submittingReview = false;
            this.notice = 'Cảm ơn bạn! Đánh giá của bạn đã được ghi nhận trên hệ thống.';
            this.reviewText = '';
            this.selectedFiles = [];
            this.loadReviews(true);
            this.loadMyReviews();
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.submittingReview = false;
            this.notice = err.error?.message || 'Không thể gửi đánh giá lúc này.';
            this.cdr.markForCheck();
          },
        });
      return;
    }

    this.notice = 'Vui lòng chọn một đặt chỗ đã hoàn tất để gửi đánh giá.';
  }

  showMoreReviews(): void {
    if (this.visibleCount < this.allReviews.length) {
      this.visibleCount = Math.min(this.allReviews.length, this.visibleCount + 6);
      this.recentReviews = this.allReviews.slice(0, this.visibleCount);
      return;
    }
    if (this.allReviews.length < this.totalReviews) {
      this.loadReviews(false);
      return;
    }
    this.visibleCount = 6;
    this.recentReviews = this.allReviews.slice(0, this.visibleCount);
  }
}
