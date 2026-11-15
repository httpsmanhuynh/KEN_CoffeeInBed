import { Component } from '@angular/core';

@Component({
  selector: 'app-journeys-page',
  standalone: false,
  templateUrl: './journeys-page.html',
  styleUrl: './journeys-page.css'
})
export class JourneysPage {
  readonly heroImage = '/images/ken-journeys/connect.jpg';

  readonly introduction = [
    'Kén · một chú sâu nhỏ, cần mẫn, lặng lẽ · sống giữa thành phố đầy tiếng ồn, nơi mọi người luôn vội vã từ điểm này sang điểm khác mà chẳng kịp dừng lại để thở.',
    'Một buổi chiều muộn, ngồi trong quán cà phê ồn ào, Kén nhìn xuống tách cà phê nguội và tự hỏi: liệu có nơi nào để chú thực sự hiện diện · không vội vã, không giả vờ, không cần chứng minh gì? Rồi một ngày, Kén tìm thấy KÉN · một không gian với tông màu kem ấm, mùi cà phê dịu nhẹ, những góc ngồi được thiết kế để người ta thực sự ở lại.'
  ];

  readonly journeys = [
    {
      number: '01',
      name: 'KÉN Kết Nối',
      icon: 'connect-icon.svg',
      tone: 'connect',
      image: '/images/ken-journeys/connect.jpg',
      imageAlt: 'Chú sâu trong không gian cà phê KÉN Kết Nối',
      badge: 'Cà phê · Gặp gỡ · Ghé trực tiếp',
      title: 'Kết nối bắt đầu từ một tách cà phê',
      subtitle: 'Không cần đặt chỗ trước, không cần lý do. Chỉ cần bước vào · và được đón nhận.',
      paragraphs: [
        'Bước vào KÉN Kết Nối, Kén ngồi xuống một chiếc ghế mềm bên cửa sổ. Mùi cà phê dẫn Kén trở lại với hiện tại. Xung quanh, người ta cười nhẹ, chia sẻ ý tưởng, hoặc chỉ đơn giản là ngồi im cạnh nhau mà không thấy cô đơn.',
        'Đây là nơi những sợi kết nối bắt đầu được se lại · không ồn ào, không áp lực. Kén nhận ra rằng đôi khi chỉ cần có mặt ở đúng nơi, những sợi tơ vô hình giữa người với người sẽ tự tìm đến nhau.'
      ],
      details: [
        { title: 'Cà phê & Trà', note: 'Thực đơn phong phú' },
        { title: 'Không đặt trước', note: 'Ghé bất cứ lúc nào' },
        { title: '08:00 – 22:00', note: 'Mở cửa hằng ngày' }
      ],
      action: 'Xem thực đơn',
      route: '/spaces/connect'
    },
    {
      number: '02',
      name: 'KÉN Tập Trung',
      icon: 'focus-icon.svg',
      tone: 'focus',
      image: '/images/ken-journeys/focus.jpg',
      imageAlt: 'Chú sâu làm việc trong không gian KÉN Tập Trung',
      badge: 'Work Lounge · Focus Pod · Phòng họp',
      title: 'Không gian để tư duy thực sự duỗi ra',
      subtitle: 'Không có tiếng ồn xâm lấn. Không có ai hỏi "sao ngồi lâu vậy?".',
      paragraphs: [
        'Hành trình thứ hai dẫn Kén vào KÉN Tập Trung · Work Lounge rộng mở, Focus Pod yên tĩnh, phòng họp nhỏ hay phòng họp lớn đều sẵn sàng. Mỗi chiếc bàn ở đây như một bệ phóng nhỏ để Kén gom từng sợi ý tưởng đang bay lơ lửng và bắt đầu dệt chúng thành hình.',
        'Chỉ có ánh sáng vừa đủ, kết nối ổn định, và khoảng không gian đủ rộng để tư duy thực sự duỗi ra. Kén lần đầu tiên cảm thấy mình có thể làm việc mà không cần chiến đấu với môi trường xung quanh.'
      ],
      details: [
        { title: 'Wi-Fi & Ổ cắm', note: 'Kết nối ổn định' },
        { title: 'Theo giờ linh hoạt', note: 'Đặt chỗ trước' },
        { title: '4 loại không gian', note: 'Phù hợp mọi nhu cầu' }
      ],
      action: 'Chọn không gian',
      route: '/spaces/work-lounge'
    },
    {
      number: '03',
      name: 'KÉN Tái Tạo',
      icon: 'rest-icon.svg',
      tone: 'rest',
      image: '/images/ken-journeys/rest.jpg',
      imageAlt: 'Chú sâu nghỉ ngơi trong chiếc kén của KÉN Tái Tạo',
      badge: 'Single Bed · Double Bed · Private Studio',
      title: 'Trở về với chính mình, theo nhịp riêng',
      subtitle: 'Không cần ngủ đủ tám tiếng. Không cần lý do. Chỉ cần vài tiếng lấy lại năng lượng.',
      paragraphs: [
        'Sau khi kết nối và tập trung, đến lúc Kén cần quay về với chính mình. KÉN Tái Tạo là kén thật sự · nơi bạn trở vào không gian riêng tư, đặt xuống mọi thứ bên ngoài và để cơ thể lẫn tâm trí được thở lại.',
        'Kén nằm xuống trong căn pod nhỏ, nghe tiếng yên lặng bao quanh. Lần đầu tiên sau rất lâu, chú không nghĩ đến deadline, không vội vã đi đâu. Đây chính là lúc những sợi tơ mới bắt đầu hình thành · không bị ép buộc, không cần hoàn hảo, chỉ cần được lớn lên theo nhịp của riêng mình.'
      ],
      details: [
        { title: 'Riêng tư tuyệt đối', note: 'Rèm che · Đèn đọc sách' },
        { title: 'Theo giờ linh hoạt', note: 'Từ 1h đến 8h' },
        { title: 'Đủ 18 tuổi', note: 'Điều kiện bắt buộc' }
      ],
      action: 'Chọn không gian nghỉ',
      route: '/spaces'
    }
  ];
}
