import { Component } from '@angular/core';

interface StoryCard {
  id: number;
  category: string;
  title: string;
  description: string;
  image: string;
  route: string;
  tone: 'dark' | 'warm';
}

@Component({
  selector: 'app-story-page',
  standalone: false,
  templateUrl: './story-page.html',
  styleUrl: './story-page.css',
})
export class StoryPage {
  readonly cards: StoryCard[] = [
    {
      id: 1,
      category: 'Câu chuyện KÉN',
      title: 'Câu chuyện con sâu dệt cuộc đời',
      description: 'Ba hành trình Kết Nối, Tập Trung và Tái Tạo · ba sợi tơ giúp KÉN gom lại những điều quan trọng.',
      image: '/images/ken-figma/stories-img0.jpg',
      route: '/our-story',
      tone: 'dark'
    },
    {
      id: 2,
      category: 'Phong cách sống',
      title: 'Chọn KÉN nào cho nhịp ngày của bạn?',
      description: 'Cà phê và gặp gỡ ở Kết Nối; làm việc ở Tập Trung; một khoảng nghỉ ở Tái Tạo.',
      image: '/images/ken-figma/stories-img1.jpg',
      route: '/spaces',
      tone: 'dark'
    },
    {
      id: 3,
      category: 'Văn hóa KÉN',
      title: 'Văn hóa giữ yên lặng và riêng tư',
      description: 'Giao tiếp đúng khu vực, giữ âm lượng vừa phải và tôn trọng không gian để ai cũng thoải mái.',
      image: '/images/ken-figma/stories-img2.jpg',
      route: '/policy',
      tone: 'dark'
    },
    {
      id: 4,
      category: 'Cẩm nang',
      title: 'Hướng dẫn đặt chỗ theo giờ tại KÉN',
      description: 'Chọn không gian, ngày giờ và gói phù hợp. Kiểm tra điều kiện và thanh toán trước khi xác nhận.',
      image: '/images/ken-figma/stories-img3.jpg',
      route: '/spaces',
      tone: 'warm'
    },
    {
      id: 5,
      category: 'Cẩm nang',
      title: 'Hủy và đổi lịch đặt chỗ tại KÉN',
      description: 'Đọc điều kiện của gói trước khi đặt. Xem phí và số tiền hoàn trước khi xác nhận thay đổi.',
      image: '/images/ken-figma/stories-img4.jpg',
      route: '/policy',
      tone: 'warm'
    },
    {
      id: 6,
      category: 'Ưu đãi',
      title: 'KÉN ĐIỂM và KÉN Coins khác nhau thế nào?',
      description: 'ĐIỂM xét hạng; Coins đổi voucher. Hai số dư độc lập, đổi Coins không làm giảm Điểm hay hạng.',
      image: '/images/ken-figma/stories-img5.jpg',
      route: '/points',
      tone: 'warm'
    },
    {
      id: 7,
      category: 'KÉN Tập Trung',
      title: 'Tập trung ở Work Lounge và Focus Pod',
      description: 'Chọn bàn chung hoặc góc riêng, chia đầu việc theo khoảng tập trung và giữ nhịp làm việc vừa sức.',
      image: '/images/ken-figma/stories-img6.jpg',
      route: '/spaces',
      tone: 'dark'
    },
    {
      id: 8,
      category: 'KÉN Tập Trung',
      title: 'Tổ chức buổi họp nhóm tại KÉN',
      description: 'Phòng họp nhỏ hoặc lớn cho nhóm cần trao đổi. Kiểm tra sức chứa, tiện ích và khung giờ khi đặt.',
      image: '/images/ken-figma/stories-img7.jpg',
      route: '/spaces/small-meeting-room',
      tone: 'dark'
    },
    {
      id: 9,
      category: 'KÉN Tái Tạo',
      title: 'Một khoảng nghỉ ở KÉN Tái Tạo',
      description: 'Single Bed Pod, Double Bed Pod và Private Studio — nghỉ ngắn theo giờ, không phải lưu trú qua đêm.',
      image: '/images/ken-figma/stories-img8.jpg',
      route: '/spaces',
      tone: 'dark'
    }
  ];

  readonly rows = [
    this.cards.slice(0, 3),
    this.cards.slice(3, 6),
    this.cards.slice(6, 9)
  ];

  private savedCards = new Set<number>([7]);

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
