import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

interface KenHomeSpace {
  label: string;
  privacy: string;
  heading: string;
  description: string;
  benefits: [string, string];
  thumb: string;
  images: string[];
  route: string | null;
}

@Component({
  selector: 'app-ken-home-content',
  standalone: false,
  templateUrl: './home-content.html',
  styleUrl: './home-content.css'
})
export class KenHomeContent implements OnInit, OnDestroy {
  @Input() member = false;
  heroIndex = 0;
  selectedSpace = 0;
  expandedFaq = 0;
  submittedMessage = '';
  private slideTimer?: ReturnType<typeof setInterval>;

  readonly slides = [
    '/images/ken-home/hero-1.png',
    '/images/ken-home/hero-2.png',
    '/images/ken-home/hero-3.png'
  ];

  readonly advantages = [
    { symbol: '/images/ken-home/icons/quiet.svg', title: 'Yên Tĩnh', description: 'Không gian tách biệt khỏi tiếng ồn phố thị, để bạn tập trung trọn vẹn.' },
    { symbol: '/images/ken-home/icons/private.svg', title: 'Riêng Tư', description: 'Cabin và phòng riêng có rèm che, giữ trọn khoảng không của riêng bạn.' },
    { symbol: '/images/ken-home/icons/flexible.svg', title: 'Linh Động', description: 'Đặt theo giờ hoặc theo combo cố định, bạn là người quyết định.' },
    { symbol: '/images/ken-home/icons/transparent.svg', title: 'Minh Bạch', description: 'Giá niêm yết rõ ràng, lưu vết tại thời điểm đặt, không phát sinh.' }
  ];

  readonly mascots = [
    { title: 'Trò chuyện', label: 'KÉN KẾT NỐI', image: '/images/ken-home/mascot-connect.png', description: 'Một nơi ấm áp để gặp gỡ, trò chuyện và nạp năng lượng bằng một ly đồ uống ngon.', route: '/spaces/connect' },
    { title: 'Làm việc', label: 'KÉN TẬP TRUNG', image: '/images/ken-home/mascot-focus.png', description: 'Một góc yên tĩnh để hoàn thành điều còn dang dở mà không bị làm phiền.', route: '/spaces/work-lounge' },
    { title: 'Nghỉ ngơi', label: 'KÉN TÁI TẠO', image: '/images/ken-home/mascot-rest.png', description: 'Một khoảng nghỉ đủ sâu để cơ thể và tâm trí phục hồi, sẵn sàng cho ngày mới.', route: '/spaces' }
  ];

  readonly steps = [
    { title: 'Chọn không gian', description: 'Chọn KÉN Tập Trung hoặc KÉN Tái Tạo phù hợp nhu cầu của bạn.' },
    { title: 'Chọn gói & khung giờ', description: 'Chọn ngày, giờ và số khách. Xem còn chỗ chưa phải là giữ chỗ.' },
    { title: 'Thêm dịch vụ', description: 'Chọn đồ uống, bánh hoặc tiện ích mua thêm phù hợp với không gian.' },
    { title: 'Xác nhận & thanh toán', description: 'Xác nhận thông tin để giữ chỗ 15 phút; thanh toán trong hạn để nhận mã đặt chỗ.' }
  ];

  readonly spaces: KenHomeSpace[] = [
    { label: 'KÉN Café', privacy: 'CỞI MỞ NHẤT', heading: 'KÉN Café', description: 'Khu vực mở như một quán cà phê quen thuộc: nơi bạn hẹn bạn bè, đọc sách hoặc ngồi làm việc nhẹ. Không giới hạn thời gian, không cần đặt trước cứ ghé và chọn một góc.', benefits: ['Cà phê & bánh ngọt', 'Gặp gỡ, trò chuyện'], thumb: '/images/ken-home/privacy-cafe.png', images: ['/images/ken-home/cafe-1.png','/images/ken-home/cafe-2.png','/images/ken-home/cafe-3.png','/images/ken-home/cafe-4.png'], route: '/spaces/connect' },
    { label: 'Bàn chung', privacy: 'KHÁ RIÊNG TƯ', heading: 'Bàn chung', description: 'Bàn dài và ánh sáng vừa đủ, Wi-Fi và ổ cắm điện để học bài, làm việc độc lập. Đặt theo người và thời lượng sử dụng.', benefits: ['Wi-Fi & ổ cắm', 'Làm việc linh hoạt'], thumb: '/images/ken-home/privacy-work.png', images: ['/images/ken-home/privacy-work.png','/images/ken-home/about-work.png'], route: '/spaces/work-lounge' },
    { label: 'Phòng họp nhỏ', privacy: 'RIÊNG TƯ', heading: 'Phòng họp nhỏ', description: 'Phòng họp riêng cho nhóm 3–6 người, trang bị máy chiếu, bảng từ và Wi-Fi, phù hợp học nhóm hoặc thảo luận dự án.', benefits: ['3–6 khách', 'Máy chiếu & bảng từ'], thumb: '/images/ken-home/privacy-meeting.png', images: ['/images/ken-home/privacy-meeting.png','/images/ken-home/about-meeting.png'], route: '/spaces/small-meeting-room' },
    { label: 'KÉN nghỉ đơn', privacy: 'RIÊNG TƯ CAO', heading: 'KÉN nghỉ đơn', description: 'Một chiếc kén nhỏ có giường nằm, rèm che và ổ cắm điện để bạn nghỉ ngắn, tái tạo năng lượng giữa ngày.', benefits: ['Dành cho 1 khách', 'Nghỉ ngắn theo giờ'], thumb: '/images/ken-home/privacy-single.png', images: ['/images/ken-home/privacy-single.png','/images/ken-home/about-rest.png'], route: '/spaces' },
    { label: 'Kén đôi', privacy: 'RIÊNG TƯ NHẤT', heading: 'KÉN nghỉ đôi', description: 'Không gian nghỉ riêng cho hai người, yên tĩnh và thoải mái, phù hợp những khoảng nghỉ ngắn trong ngày.', benefits: ['1–2 khách', 'Kén nghỉ riêng'], thumb: '/images/ken-home/privacy-double.png', images: ['/images/ken-home/privacy-double.png','/images/ken-home/about-rest.png'], route: '/spaces' }
  ];

  readonly prices = [
    { eyebrow: 'KÉN TẬP TRUNG · GÓI LINH HOẠT', title: 'Bàn chung', icon: '/images/ken-home/icons/price-laptop.svg', price: '30.000đ', sub: 'mỗi người / giờ · tối thiểu 1 giờ', items: ['Wi-Fi, ổ cắm điện, bàn làm việc chung', 'Từ 2 giờ: mỗi khách 01 chai nước suối', 'Gói Nửa ngày (4 giờ): 90.000đ/người', 'Gói 4 giờ: 01 đồ uống tiêu chuẩn/khách'], note: 'Giá tính theo người; nước suối của gói giờ chỉ áp dụng khi đặt từ 2 giờ.', route: '/spaces/work-lounge', featured: false },
    { eyebrow: 'KÉN TẬP TRUNG · HỌP NHÓM NHỎ (3 GIỜ)', title: 'Phòng họp nhỏ', icon: '/images/ken-home/icons/price-door.svg', price: '250.000đ', sub: 'mỗi không gian / gói 3 giờ · 3–6 người', items: ['Không gian riêng cho nhóm 3–6 người', 'Bao gồm máy chiếu', 'Bao gồm bảng từ và Wi-Fi', 'Mỗi khách 01 chai nước suối'], note: 'Phù hợp họp nhóm, học nhóm.', route: '/spaces/small-meeting-room', featured: true },
    { eyebrow: 'KÉN TÁI TẠO · KÉN RIÊNG', title: 'KÉN nghỉ đơn', icon: '/images/ken-home/icons/price-moon.svg', price: '70.000đ', sub: 'mỗi kén / gói Nghỉ nhanh 1 giờ · 1 khách', items: ['Giường nằm đơn, ổ cắm điện', 'Gói 1 giờ: không bao gồm F&B', 'Gói Ngả lưng (2 giờ): 130.000đ/kén', 'Gói 2 giờ: 01 đồ uống tiêu chuẩn/khách'], note: '15 phút dọn sau giờ sử dụng, không tính trong gói.', route: '/spaces', featured: false }
  ];

  readonly addons = [
    { name: 'Americano', price: '40.000đ', icon: '/images/ken-home/icons/addon-coffee.svg' },
    { name: 'Matcha Latte / Hojicha Latte', price: '55.000đ', icon: '/images/ken-home/icons/addon-leaf.svg' },
    { name: 'Bánh sừng bò (Croissant) cơ bản', price: '35.000đ', icon: '/images/ken-home/icons/addon-croissant.svg' },
    { name: 'Bộ nghỉ ngơi (bịt mắt, nút tai)', price: '20.000đ', icon: '/images/ken-home/icons/addon-headphones.svg' },
    { name: 'Chăn mỏng thêm', price: '15.000đ', icon: '/images/ken-home/icons/addon-blanket.svg' },
    { name: 'Khăn ấm', price: '10.000đ', icon: '/images/ken-home/icons/addon-hand.svg' }
  ];

  readonly gallery = ['moments-8.png', 'moments-7.png', 'moments-6.png', 'moments-5.png', 'moments-4.png', 'moments-3.png', 'moments-2.png', 'moments-1.png'];

  readonly faqs = [
    { question: 'KÉN khác gì một quán cà phê thông thường?', answer: 'KÉN không chỉ bán cà phê mà bán quyền sử dụng không gian và thời gian. Bạn có thể chọn làm việc yên tĩnh ở KÉN Tập Trung hoặc chợp mắt trong kén riêng ở KÉN Tái Tạo, tất cả ở cùng một điểm đến.' },
    { question: 'Tôi có cần đặt trước khi ghé KÉN Kết Nối không?', answer: 'Không. KÉN Kết Nối là khu café ghé trực tiếp, không nhận đặt bàn trực tuyến. Những khu vực làm việc hoặc nghỉ riêng mới sử dụng gói đặt chỗ.' },
    { question: 'Giá đặt chỗ được tính như thế nào?', answer: 'Bàn chung tính theo người và số giờ; phòng họp và kén nghỉ tính theo gói không gian. Các dịch vụ mua thêm sẽ được tách riêng.' },
    { question: 'KÉN Tái Tạo có giới hạn độ tuổi không?', answer: 'KÉN Tái Tạo dành cho người từ đủ 18 tuổi. Vui lòng kiểm tra các điều khoản trước khi đặt.' },
    { question: 'Nếu tôi đặt chỗ nhưng chưa thanh toán thì sao?', answer: 'Xác nhận tóm tắt đặt chỗ mới giữ chỗ trong 15 phút. Nếu không hoàn tất thanh toán trong hạn, chỗ không còn được giữ.' },
    { question: 'Tôi có thể đặt nhiều không gian cùng lúc không?', answer: 'Bạn cần kiểm tra lịch trống và gói áp dụng cho từng không gian. Việc chọn khung giờ chưa tạo đơn đặt chỗ.' }
  ];

  readonly consultation: FormGroup;

  constructor(private fb: FormBuilder) {
    this.consultation = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.pattern(/^(0|\+84)[0-9]{9,10}$/)]],
      email: ['', [Validators.required, Validators.email]],
      space: ['', Validators.required],
      hours: ['', Validators.required],
      note: ['', Validators.maxLength(500)]
    });
  }

  ngOnInit(): void {
    this.slideTimer = setInterval(() => this.heroIndex = (this.heroIndex + 1) % this.slides.length, 6500);
  }

  ngOnDestroy(): void {
    if (this.slideTimer) clearInterval(this.slideTimer);
  }

  setSlide(index: number): void {
    this.heroIndex = index;
  }

  selectSpace(index: number): void {
    this.selectedSpace = index;
  }

  toggleFaq(index: number): void {
    this.expandedFaq = this.expandedFaq === index ? -1 : index;
  }

  submitConsultation(): void {
    this.submittedMessage = '';
    if (this.consultation.invalid) {
      this.consultation.markAllAsTouched();
      this.submittedMessage = 'Vui lòng kiểm tra và điền đầy đủ thông tin hợp lệ.';
      return;
    }
    this.submittedMessage = 'Thông tin đã hợp lệ. Chức năng gửi yêu cầu đến KÉN đang chờ kết nối máy chủ; chưa có yêu cầu nào được gửi.';
  }
}

@Component({ selector: 'app-ken-home-guest-page', standalone: false, template: '<app-ken-home-content [member]="false"></app-ken-home-content>' })
export class HomeGuestPage {}

@Component({ selector: 'app-ken-home-member-page', standalone: false, template: '<app-header [isLoggedIn]="true" userName="Tài khoản của tôi"></app-header><app-ken-home-content [member]="true"></app-ken-home-content><app-footer></app-footer>' })
export class HomeMemberPage {}
