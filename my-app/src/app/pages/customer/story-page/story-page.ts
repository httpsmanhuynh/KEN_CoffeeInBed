import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

interface StoryCard {
  id: number;
  category: string;
  title: string;
  description: string;
  image: string;
  route: string;
  tone: 'dark' | 'warm';
  readTime: string;
  publishedAt: string;
  content: string[];
  ctaLabel?: string;
  ctaRoute?: string;
}

@Component({
  selector: 'app-story-page',
  standalone: false,
  templateUrl: './story-page.html',
  styleUrl: './story-page.css',
})
export class StoryPage implements OnInit, OnDestroy {
  private readonly route = (() => {
    try {
      return inject(ActivatedRoute, { optional: true });
    } catch {
      return null;
    }
  })();
  private readonly cdr = (() => {
    try {
      return inject(ChangeDetectorRef, { optional: true });
    } catch {
      return null;
    }
  })();

  private sub?: Subscription;
  selectedStory: StoryCard | null = null;

  readonly cards: StoryCard[] = [
    {
      id: 1,
      category: 'Câu chuyện KÉN',
      title: 'Câu chuyện con sâu dệt cuộc đời',
      description:
        'Ba hành trình Kết Nối, Tập Trung và Tái Tạo · ba sợi tơ giúp KÉN gom lại những điều quan trọng.',
      image: '/images/ken-figma/stories-img0.jpg',
      route: '/blog/1',
      tone: 'dark',
      readTime: '4 phút đọc',
      publishedAt: '12/10/2026',
      content: [
        'Trong tự nhiên, chiếc kén không phải nơi trốn chạy thế giới, mà là một khoảng lặng cần thiết để chú sâu nhỏ gom lại năng lượng và chuyển hóa thành hình hài mới.',
        'Tại KÉN, chúng tôi chia trải nghiệm trong ngày thành ba hành trình nối tiếp nhau: Kết Nối để gặp gỡ và sẻ chia bên ly cà phê, Tập Trung để hoàn thành trọn vẹn công việc dang dở, và Tái Tạo để lắng nghe cơ thể nghỉ ngơi đúng lúc.',
        'Dù bạn ghé KÉN chỉ một tiếng buổi trưa hay ở lại trọn vẹn cả ngày, điều quan trọng nhất là bạn được quyền đi theo nhịp điệu của riêng mình.',
      ],
      ctaLabel: 'Khám phá câu chuyện 3 hành trình',
      ctaRoute: '/our-story',
    },
    {
      id: 2,
      category: 'Phong cách sống',
      title: 'Chọn KÉN nào cho nhịp ngày của bạn?',
      description: 'Cà phê và gặp gỡ ở Kết Nối; làm việc ở Tập Trung; một khoảng nghỉ ở Tái Tạo.',
      image: '/images/ken-figma/stories-img1.jpg',
      route: '/blog/2',
      tone: 'dark',
      readTime: '3 phút đọc',
      publishedAt: '15/10/2026',
      content: [
        'Mỗi thời điểm trong ngày đều cần một kiểu không gian khác nhau. Buổi sáng nhiều năng lượng hợp với khu KÉN Kết Nối mở rộng — nơi bạn có thể vừa thưởng thức cà phê rang xay vừa trò chuyện cùng bạn bè.',
        'Khi cần tập trung sâu cho bài tập, dự án hoặc cuộc họp nhóm nhỏ, KÉN Tập Trung cung cấp Work Lounge, Focus Pod cá nhân và phòng họp trang bị máy chiếu, bảng từ cùng Wi-Fi ổn định.',
        'Và khi đồng hồ điểm đầu giờ chiều hoặc sau những giờ làm việc căng thẳng, KÉN Tái Tạo với các bed pod riêng tư giúp bạn chợp mắt ngắn từ 1 đến 4 giờ để lấy lại tinh thần.',
      ],
      ctaLabel: 'Xem các không gian tại KÉN',
      ctaRoute: '/spaces',
    },
    {
      id: 3,
      category: 'Văn hóa KÉN',
      title: 'Văn hóa giữ yên lặng và riêng tư',
      description:
        'Giao tiếp đúng khu vực, giữ âm lượng vừa phải và tôn trọng không gian để ai cũng thoải mái.',
      image: '/images/ken-figma/stories-img2.jpg',
      route: '/blog/3',
      tone: 'dark',
      readTime: '3 phút đọc',
      publishedAt: '18/10/2026',
      content: [
        'Sự dễ chịu của một không gian chung đến từ những thỏa thuận nhỏ nhưng tử tế giữa những người cùng sử dụng.',
        'Ở KÉN Kết Nối, bạn thoải mái trò chuyện, bật nhạc nhẹ qua tai nghe hoặc thảo luận cùng nhóm bạn. Khi bước sang KÉN Tập Trung và KÉN Tái Tạo, âm lượng điện thoại và các cuộc gọi được giữ ở mức tối thiểu để không ảnh hưởng đến người bên cạnh.',
        'Nếu cần trao đổi nhiều người hoặc họp trực tuyến có phát biểu, đội ngũ KÉN luôn gợi ý bạn chọn Phòng họp nhỏ hoặc Phòng họp lớn để vừa riêng tư vừa tự nhiên nhất.',
      ],
      ctaLabel: 'Xem chính sách hoạt động',
      ctaRoute: '/policy',
    },
    {
      id: 4,
      category: 'Cẩm nang',
      title: 'Hướng dẫn đặt chỗ theo giờ tại KÉN',
      description:
        'Chọn không gian, ngày giờ và gói phù hợp. Kiểm tra điều kiện và thanh toán trước khi xác nhận.',
      image: '/images/ken-figma/stories-img3.jpg',
      route: '/blog/4',
      tone: 'warm',
      readTime: '4 phút đọc',
      publishedAt: '21/10/2026',
      content: [
        'Quy trình đặt chỗ tại KÉN gồm 4 bước gọn nhẹ: chọn không gian phù hợp, kiểm tra khung giờ trống theo ngày và số khách, lựa chọn đồ uống/tiện ích mua thêm (nếu cần), và xác nhận giữ chỗ.',
        'Lưu ý nhỏ: bước kiểm tra chỗ trống giúp bạn xem trước tình trạng phòng mà chưa tạo đơn giữ chỗ. Chỉ khi bạn xác nhận thông tin ở bước tóm tắt, hệ thống mới giữ chỗ trong 15 phút để bạn hoàn tất thanh toán.',
        'Ngay sau khi thanh toán thành công, mã đặt chỗ sẽ hiển thị tại mục Lịch sử đặt chỗ để bạn check-in nhanh tại quầy.',
      ],
      ctaLabel: 'Thử đặt không gian ngay',
      ctaRoute: '/spaces',
    },
    {
      id: 5,
      category: 'Cẩm nang',
      title: 'Hủy và đổi lịch đặt chỗ tại KÉN',
      description:
        'Đọc điều kiện của gói trước khi đặt. Xem phí và số tiền hoàn trước khi xác nhận thay đổi.',
      image: '/images/ken-figma/stories-img4.jpg',
      route: '/blog/5',
      tone: 'warm',
      readTime: '3 phút đọc',
      publishedAt: '24/10/2026',
      content: [
        'Kế hoạch trong ngày đôi khi thay đổi bất ngờ. Vì vậy KÉN thiết kế công cụ Hủy đặt chỗ và Đổi lịch trực tiếp trong tài khoản để bạn chủ động xử lý mà không cần chờ gọi hotline.',
        'Trước khi xác nhận hủy hoặc đổi giờ, màn hình luôn hiển thị rõ thời lượng gói đang giữ, mức phí áp dụng (nếu gần sát giờ nhận chỗ) và số tiền dự kiến hoàn lại.',
        'Khi đổi lịch, thời lượng gói gốc của đơn đặt chỗ được giữ nguyên để đảm bảo quyền lợi đồ uống và tiện ích đi kèm.',
      ],
      ctaLabel: 'Xem điều kiện & điều khoản',
      ctaRoute: '/terms',
    },
    {
      id: 6,
      category: 'Ưu đãi',
      title: 'KÉN ĐIỂM và KÉN Coins khác nhau thế nào?',
      description:
        'ĐIỂM xét hạng; Coins đổi voucher. Hai số dư độc lập, đổi Coins không làm giảm Điểm hay hạng.',
      image: '/images/ken-figma/stories-img5.jpg',
      route: '/blog/6',
      tone: 'warm',
      readTime: '3 phút đọc',
      publishedAt: '27/10/2026',
      content: [
        'Nhiều khách hàng mới thường nhầm lẫn giữa Điểm xét hạng và KÉN Coins. Thực tế, đây là hai cơ chế đồng hành hoàn toàn tách biệt.',
        'Điểm tích lũy dùng để nâng hạng hội viên (Basic, Silver, Gold), mang lại mức ưu đãi trực tiếp trên mỗi đơn đặt chỗ. Trong khi đó, KÉN Coins là đơn vị thưởng để bạn đổi lấy các voucher giảm giá đồ uống hoặc giờ sử dụng không gian.',
        'Khi bạn dùng Coins đổi voucher, số Điểm xét hạng và hạng hội viên hiện tại của bạn vẫn được giữ nguyên hoàn toàn.',
      ],
      ctaLabel: 'Tìm hiểu KÉN Điểm',
      ctaRoute: '/points',
    },
    {
      id: 7,
      category: 'KÉN Tập Trung',
      title: 'Tập trung ở Work Lounge và Focus Pod',
      description:
        'Chọn bàn chung hoặc góc riêng, chia đầu việc theo khoảng tập trung và giữ nhịp làm việc vừa sức.',
      image: '/images/ken-figma/stories-img6.jpg',
      route: '/blog/7',
      tone: 'dark',
      readTime: '4 phút đọc',
      publishedAt: '30/10/2026',
      content: [
        'Work Lounge phù hợp khi bạn thích không khí có vài người xung quanh đang cùng chăm chú làm việc — đủ động lực mà không quá ồn ào.',
        'Ngược lại, Focus Pod được thiết kế dạng ô cá nhân với vách ngăn riêng tư, ánh sáng ấm tập trung vào mặt bàn và ổ cắm tiện lợi ngay tầm tay, rất hợp để ôn thi, đọc tài liệu dài hoặc xử lý công việc đòi hỏi sự yên tĩnh cao.',
        'Bạn có thể đặt linh hoạt theo giờ hoặc chọn gói 4 giờ để được tặng kèm đồ uống tiêu chuẩn ngay tại bàn.',
      ],
      ctaLabel: 'Xem chi tiết Work Lounge',
      ctaRoute: '/spaces/work-lounge',
    },
    {
      id: 8,
      category: 'KÉN Tập Trung',
      title: 'Tổ chức buổi họp nhóm tại KÉN',
      description:
        'Phòng họp nhỏ hoặc lớn cho nhóm cần trao đổi. Kiểm tra sức chứa, tiện ích và khung giờ khi đặt.',
      image: '/images/ken-figma/stories-img7.jpg',
      route: '/blog/8',
      tone: 'dark',
      readTime: '3 phút đọc',
      publishedAt: '02/11/2026',
      content: [
        'Một buổi brainstorm hay thuyết trình nhóm hiệu quả bắt đầu từ căn phòng đủ ánh sáng, có sẵn máy chiếu, bảng từ và không bị tạp âm ngắt quãng.',
        'KÉN cung cấp Phòng họp nhỏ (3–6 khách) và Phòng họp lớn (6–12 khách) theo gói 3 giờ trọn vẹn, kèm nước suối cho từng thành viên.',
        'Nếu nhóm cần thêm màn hình phụ, bộ bút bảng hoặc chuẩn bị sẵn cà phê và bánh trước giờ họp, bạn chỉ cần chọn ở bước Add-on khi đặt phòng.',
      ],
      ctaLabel: 'Xem Phòng họp nhỏ',
      ctaRoute: '/spaces/small-meeting-room',
    },
    {
      id: 9,
      category: 'KÉN Tái Tạo',
      title: 'Một khoảng nghỉ ở KÉN Tái Tạo',
      description:
        'Single Bed Pod, Double Bed Pod và Private Studio — nghỉ ngắn theo giờ, không phải lưu trú qua đêm.',
      image: '/images/ken-figma/stories-img8.jpg',
      route: '/blog/9',
      tone: 'dark',
      readTime: '3 phút đọc',
      publishedAt: '05/11/2026',
      content: [
        'Không phải lúc nào ta cũng cần một kỳ nghỉ dài; đôi khi chỉ cần 60 đến 120 phút tách khỏi màn hình và tiếng còi xe để cơ thể được phục hồi.',
        'Khu KÉN Tái Tạo được bố trí tách biệt với rèm che kín đáo, đèn đọc sách dịu mắt, chăn gối vệ sinh sạch sẽ sau mỗi lượt khách (luôn có 15 phút dọn dẹp giữa hai ca đặt).',
        'Lưu ý: KÉN Tái Tạo phục vụ nghỉ ngơi theo giờ trong khung 08:00–22:00 dành cho khách từ đủ 18 tuổi và không phải mô hình lưu trú qua đêm.',
      ],
      ctaLabel: 'Xem KÉN nghỉ đơn',
      ctaRoute: '/spaces/single',
    },
  ];

  readonly rows = [this.cards.slice(0, 3), this.cards.slice(3, 6), this.cards.slice(6, 9)];

  private savedCards = new Set<number>([7]);

  ngOnInit(): void {
    this.sub = this.route?.paramMap.subscribe((params) => {
      const idParam = params.get('id');
      if (!idParam) {
        this.selectedStory = null;
      } else {
        const numericId = Number(idParam);
        this.selectedStory = this.cards.find((c) => c.id === numericId) ?? this.cards[0];
      }
      this.cdr?.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get relatedStories(): StoryCard[] {
    if (!this.selectedStory) return [];
    return this.cards.filter((c) => c.id !== this.selectedStory!.id).slice(0, 3);
  }

  isSaved(id: number): boolean {
    return this.savedCards.has(id);
  }

  toggleSaved(id: number): void {
    if (this.savedCards.has(id)) {
      this.savedCards.delete(id);
    } else {
      this.savedCards.add(id);
    }
  }
}
