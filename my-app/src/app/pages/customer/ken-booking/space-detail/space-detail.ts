import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { KenBookingSpace, KenBookingState, kenMoney } from '../booking-state';

interface KenSpacePresentation {
  eyebrow: string;
  lead: string;
  fit: string;
  consider: string;
  amenities: string;
  gallery: [string, string, string];
  captions: [string, string, string];
  packageNotes: Record<number, string>;
  bufferNote: string;
}

@Component({
  selector: 'app-ken-booking-space-detail',
  standalone: false,
  templateUrl: './space-detail.html',
  styleUrl: './space-detail.css'
})
export class KenBookingSpaceDetailPage implements OnInit {
  space?: KenBookingSpace;
  readonly money = kenMoney;
  private readonly presentation: Record<string, KenSpacePresentation> = {
    work: {
      eyebrow: 'KÉN TẬP TRUNG / WL-01 · WORK LOUNGE',
      lead: 'Dành cho người làm việc tự do, học bài hoặc cần đổi góc ngồi. Bàn chung cho một nhịp làm việc độc lập, trong không gian dùng chung tối đa 20 khách.',
      fit: 'Bạn đi một mình hoặc theo nhóm nhỏ, muốn học và làm việc trong không gian mở với thời lượng linh hoạt.',
      consider: 'Đây là khu dùng chung, không có phòng riêng. Nếu cần trao đổi riêng tư, hãy chọn một phòng họp.',
      amenities: 'Wi-Fi · Ổ cắm điện · Bàn chung · 1–20 khách',
      gallery: ['/images/ken-figma/cowork-page-wide.png', '/images/ken-figma/cowork-page-side.png', '/images/ken-figma/cowork-page-amenities.png'],
      captions: ['Toàn cảnh khu làm việc chung', 'Góc nhìn khác', 'Chi tiết tiện ích'],
      packageNotes: {
        1: 'Theo người. Đặt từ 2 giờ: mỗi khách có 1 nước suối.',
        4: 'Theo người · Mỗi khách có 1 đồ uống Menu Tiêu chuẩn.',
        14: 'Theo người · Mỗi khách có 2 đồ uống tiêu chuẩn và 1 bánh.'
      },
      bufferNote: 'Không gian dùng chung, không có thời gian dọn chuyển lượt.'
    },
    'meeting-small': {
      eyebrow: 'KÉN TẬP TRUNG / SMR-01 · SMALL MEETING ROOM',
      lead: 'Vừa đủ cho nhóm học tập, thảo luận dự án hoặc một buổi trao đổi cần riêng tư. Cả phòng dành riêng cho nhóm từ 3 đến 6 khách.',
      fit: 'Nhóm 3–6 khách cần họp, trình bày hoặc học nhóm trong không gian riêng.',
      consider: 'Giá tính trọn phòng theo gói 3 giờ. Nhóm trên 6 khách nên chọn Phòng họp lớn.',
      amenities: 'Máy chiếu · Bảng từ · Wi-Fi · 3–6 khách',
      gallery: ['/images/ken-figma/meeting-page-wide.png', '/images/ken-figma/meeting-page-side.png', '/images/ken-figma/meeting-page-amenities.png'],
      captions: ['Toàn cảnh phòng họp nhỏ', 'Góc nhìn khác', 'Chi tiết bảng từ'],
      packageNotes: { 3: 'Gói 3 giờ · Có 1 chai nước suối cho mỗi khách.' },
      bufferNote: 'Đệm dọn 15 phút sau giờ sử dụng, không tính vào thời lượng gói.'
    },
    'meeting-large': {
      eyebrow: 'KÉN TẬP TRUNG / LMR-01 · LARGE MEETING ROOM',
      lead: 'Không gian họp riêng cho workshop, trình bày hoặc cuộc họp nội bộ cần chỗ ngồi rộng rãi cho nhóm đông.',
      fit: 'Nhóm 6–12 khách cần họp, trình bày hoặc tổ chức workshop trong phòng riêng.',
      consider: 'Gói sử dụng cố định 3 giờ. Nhóm dưới 6 khách có thể chọn Phòng họp nhỏ.',
      amenities: 'Máy chiếu · Bảng từ · Wi-Fi · 6–12 khách',
      gallery: ['/images/ken-figma/spaces-meetingbig.png', '/images/ken-figma/meeting-page-side.png', '/images/ken-figma/meeting-page-amenities.png'],
      captions: ['Toàn cảnh phòng họp lớn', 'Không gian phòng họp', 'Trang thiết bị'],
      packageNotes: { 3: 'Gói 3 giờ · Có 1 chai nước suối cho mỗi khách.' },
      bufferNote: 'Đệm dọn 15 phút sau giờ sử dụng, không tính vào thời lượng gói.'
    },
    single: {
      eyebrow: 'KÉN TÁI TẠO / REST-01 · SINGLE POD',
      lead: 'Một chiếc kén nghỉ riêng tư dành cho một người, phù hợp để nghỉ trưa ngắn hoặc nạp lại năng lượng giữa ngày.',
      fit: 'Bạn đi một mình và muốn có khoảng nghỉ yên tĩnh, riêng tư.',
      consider: 'Không gian chỉ dành cho 1 khách. Nếu đi cùng người khác, hãy chọn KÉN nghỉ đôi.',
      amenities: 'Giường nghỉ · Rèm che · Đèn đọc sách · 1 khách',
      gallery: ['/images/ken-flow/listing-single.png', '/images/ken-flow/listing-single.png', '/images/ken-flow/listing-single.png'],
      captions: ['KÉN nghỉ đơn', 'Không gian nghỉ riêng', 'Chi tiết tiện ích'],
      packageNotes: { 1: 'Gói 1 giờ · Dành cho 1 khách.', 2: 'Gói 2 giờ · Dành cho 1 khách.', 4: 'Gói 4 giờ · Dành cho 1 khách.' },
      bufferNote: 'Đệm dọn 15 phút sau giờ sử dụng, không tính vào thời lượng gói.'
    },
    double: {
      eyebrow: 'KÉN TÁI TẠO / REST-02 · DOUBLE POD',
      lead: 'Không gian nghỉ với giường đôi dành cho một hoặc hai khách cần thư giãn cùng nhau.',
      fit: 'Một hoặc hai khách muốn nghỉ ngắn trong không gian riêng.',
      consider: 'Tối đa 2 khách. Nhóm từ 3–4 người nên chọn Phòng riêng tư.',
      amenities: 'Giường đôi · Rèm che · Đèn đọc sách · 1–2 khách',
      gallery: ['/images/ken-flow/listing-double.png', '/images/ken-flow/listing-double.png', '/images/ken-flow/listing-double.png'],
      captions: ['KÉN nghỉ đôi', 'Không gian nghỉ riêng', 'Chi tiết tiện ích'],
      packageNotes: { 1: 'Gói 1 giờ · Giá trọn không gian.', 2: 'Gói 2 giờ · Giá trọn không gian.', 4: 'Gói 4 giờ · Giá trọn không gian.' },
      bufferNote: 'Đệm dọn 15 phút sau giờ sử dụng, không tính vào thời lượng gói.'
    },
    private: {
      eyebrow: 'KÉN TÁI TẠO / PRIVATE ROOM',
      lead: 'Phòng riêng có giường nằm và ổ cắm điện, dành cho nhóm nhỏ 2–4 khách muốn nghỉ ngơi cùng nhau.',
      fit: 'Nhóm 2–4 khách cần một phòng riêng để nghỉ ngơi.',
      consider: 'Không nhận đặt cho 1 khách. Nếu cần học hoặc họp, hãy chọn KÉN Tập Trung.',
      amenities: 'Phòng riêng · Giường nghỉ · Ổ cắm điện · 2–4 khách',
      gallery: ['/images/ken-flow/listing-private.png', '/images/ken-flow/listing-private.png', '/images/ken-flow/listing-private.png'],
      captions: ['Phòng riêng tư', 'Không gian nghỉ riêng', 'Chi tiết tiện ích'],
      packageNotes: { 1: 'Gói 1 giờ · Giá trọn phòng.', 2: 'Gói 2 giờ · Giá trọn phòng.', 4: 'Gói 4 giờ · Giá trọn phòng.' },
      bufferNote: 'Đệm dọn 15 phút sau giờ sử dụng, không tính vào thời lượng gói.'
    }
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public state: KenBookingState
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.space = this.state.getSpace(params.get('id') || '');
    });
  }

  bookingPath(): string {
    return this.space ? '/booking/' + this.space.id : '/spaces';
  }

  get zoneLabel(): string {
    return this.space && ['single', 'double', 'private'].includes(this.space.id)
      ? 'KÉN TÁI TẠO'
      : 'KÉN TẬP TRUNG';
  }

  getRateLabel(rate: { hours: number; price: number }): string {
    if (this.space?.id === 'work' && rate.hours === 14) return 'Cả ngày · 08:00–22:00';
    if (this.space?.id === 'work' && rate.hours === 4) return 'Nửa ngày · 4 giờ';
    return this.space?.id === 'work' ? 'Linh hoạt · Tối thiểu 1 giờ' : `${rate.hours} giờ`;
  }

  get content(): KenSpacePresentation | undefined {
    return this.space ? this.presentation[this.space.id] : undefined;
  }

  packageNote(hours: number): string {
    return this.content?.packageNotes[hours] || 'Gói sử dụng riêng theo thời lượng đã chọn.';
  }
}
