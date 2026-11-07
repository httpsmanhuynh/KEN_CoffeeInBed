import { Component } from '@angular/core';

interface SpaceCard {
  id: string;
  title: string;
  badge: string;
  capacity: string;
  description: string;
  price: string;
  recommended: string;
  caution: string;
  image: string;
  route: string | null;
}

@Component({
  selector: 'app-spaces-page',
  standalone: false,
  templateUrl: './spaces-page.html',
  styleUrl: './spaces-page.css'
})
export class SpacesPage {
  bookingNotice = false;
  menuNotice = false;

  readonly spaces: SpaceCard[] = [
    {
      id: 'connect',
      title: 'KÉN Kết Nối',
      badge: 'Không đặt chỗ',
      capacity: 'Café · Ghé trực tiếp',
      description: 'Không gian café mở để gặp gỡ, trò chuyện và thưởng thức đồ uống. Ghé trực tiếp, không đặt bàn trực tuyến.',
      price: 'Ghé trực tiếp · Không đặt chỗ',
      recommended: 'Nên chọn khi: muốn hẹn bạn bè, trò chuyện hoặc đọc sách bên ly cà phê.',
      caution: 'Cân nhắc: nếu cần một chỗ làm việc riêng, hãy xem KÉN Tập Trung.',
      image: '/images/ken-figma/spaces-connect.png',
      route: '/spaces/connect'
    },
    {
      id: 'cowork',
      title: 'Khu làm việc chung',
      badge: 'Dùng chung',
      capacity: '1–20 khách',
      description: 'Bàn chung, Wi-Fi, ổ cắm điện. Phù hợp làm việc tự do, học bài hoặc nhóm nhỏ không cần riêng tư cao.',
      price: '30.000đ / người / giờ',
      recommended: 'Nên chọn khi: học hoặc làm việc cá nhân, muốn linh hoạt thời gian và ngân sách.',
      caution: 'Cân nhắc: đây là khu dùng chung, không phải phòng riêng để họp nhóm.',
      image: '/images/ken-figma/spaces-cowork.png',
      route: '/spaces/work-lounge'
    },
    {
      id: 'focus',
      title: 'Ô tập trung cá nhân',
      badge: 'Dùng riêng',
      capacity: '1 khách',
      description: 'Góc yên tĩnh, Wi-Fi, ổ cắm điện. Phù hợp đọc sâu, học bài hoặc hoàn thành công việc cần tập trung.',
      price: '45.000đ / ô / giờ',
      recommended: 'Nên chọn khi: cần yên tĩnh cao và tập trung sâu.',
      caution: 'Cân nhắc: chỉ phù hợp 1 người; nhóm đôi nên dùng 2 chỗ Work Lounge.',
      image: '/images/ken-figma/spaces-focus.png',
      route: '/spaces/focus-pod'
    },
    {
      id: 'meeting',
      title: 'Phòng họp nhỏ',
      badge: 'Dùng riêng',
      capacity: '3–6 khách',
      description: 'Phòng họp nhỏ, máy chiếu, bảng từ, Wi-Fi. Phù hợp nhóm học tập, thảo luận dự án hoặc trao đổi riêng tư.',
      price: '250.000đ / phòng / gói 3 giờ',
      recommended: 'Nên chọn khi: nhóm 3–6 người cần họp, học nhóm hoặc trao đổi riêng tư.',
      caution: 'Cân nhắc: cần ít nhất 3 khách; hai người làm việc có thể chọn 2 chỗ Bàn chung.',
      image: '/images/ken-figma/spaces-meeting.png',
      route: '/spaces/small-meeting-room'
    },
    {
      id: 'boardroom',
      title: 'Phòng họp lớn',
      badge: 'Dùng riêng',
      capacity: '6–12 khách',
      description: 'Phòng họp lớn, máy chiếu, bảng từ, Wi-Fi. Phù hợp workshop, trình bày hoặc họp nội bộ cần nhiều người.',
      price: '450.000đ / phòng / gói 3 giờ',
      recommended: 'Nên chọn khi: nhóm 6–12 người cần họp lớn, trình bày hoặc workshop.',
      caution: 'Cân nhắc: cần ít nhất 6 khách; nhóm 3–6 người có thể xem Phòng họp nhỏ.',
      image: '/images/ken-figma/spaces-meetingbig.png',
      route: null
    },
    {
      id: 'single',
      title: 'KÉN nghỉ đơn',
      badge: 'Dùng riêng',
      capacity: '1 khách',
      description: 'Kén nghỉ đơn, giường nằm, ổ cắm điện. Phù hợp nghỉ trưa ngắn giữa ngày hoặc cần một khoảng riêng.',
      price: '70.000đ / KÉN / gói 1 giờ',
      recommended: 'Nên chọn khi: cần nghỉ trưa ngắn hoặc một khoảng riêng cho 1 người.',
      caution: 'Cân nhắc: chỉ dành cho 1 khách; hai người nên xem KÉN nghỉ đôi.',
      image: '/images/ken-figma/spaces-single.png',
      route: null
    },
    {
      id: 'double',
      title: 'KÉN nghỉ đôi',
      badge: 'Dùng riêng',
      capacity: '1–2 khách',
      description: 'Kén nghỉ đôi, giường đôi, ổ cắm điện. Phù hợp cặp đôi hoặc 2 người cần nghỉ ngắn cùng lúc.',
      price: '100.000đ / KÉN / gói 1 giờ',
      recommended: 'Nên chọn khi: cặp đôi hoặc 2 người cần nghỉ ngắn cùng lúc.',
      caution: 'Cân nhắc: nhóm 3–4 người nên dùng Private Studio để rộng rãi hơn.',
      image: '/images/ken-figma/spaces-double.png',
      route: null
    },
    {
      id: 'private',
      title: 'Phòng riêng tư',
      badge: 'Dùng riêng',
      capacity: '2–4 khách',
      description: 'Phòng riêng có giường nằm và ổ cắm điện, dành cho nhóm nhỏ 2–4 khách muốn nghỉ ngơi cùng nhau.',
      price: '150.000đ / phòng / gói 1 giờ',
      recommended: 'Nên chọn khi: nhóm 2–4 người cần một phòng riêng để nghỉ ngơi.',
      caution: 'Cân nhắc: không nhận 1 khách; nếu cần học hoặc họp, hãy xem KÉN Tập Trung.',
      image: '/images/ken-figma/spaces-private.png',
      route: null
    }
  ];

  trackBySpace(_: number, space: SpaceCard): string {
    return space.id;
  }
}