import { Component } from '@angular/core';

@Component({
  selector: 'app-points-page',
  standalone: false,
  templateUrl: './points-page.html',
  styleUrl: './points-page.css'
})
export class PointsPage {

  readonly cards = [
    {
      title: 'KÉN ĐIỂM',
      icon: 'wallet.svg',
      label: 'Dùng để xét hạng thành viên',
      description: '10.000đ chi tiêu hợp lệ = 1 KÉN ĐIỂM. Điểm được cộng sau khi hoàn thành dịch vụ. Không quy ra tiền, không đổi quà.',
      note: 'Xét hạng · Không đổi quà'
    },
    {
      title: 'KÉN Coins',
      icon: 'gift.svg',
      label: 'Dùng để đổi voucher và quà',
      description: '10.000đ chi tiêu hợp lệ = 1 Coin. Đổi voucher/quà không ảnh hưởng đến KÉN ĐIỂM hay hạng của bạn.',
      note: 'Đổi quà · Độc lập với Điểm'
    },
    {
      title: 'Hạng thành viên',
      icon: 'info.svg',
      label: 'Bạc · Vàng · Kim Cương',
      description: 'Dựa trên KÉN ĐIỂM tích lũy trong 1 năm. Mỗi hạng mở thêm ưu đãi giảm giá. Sang năm mới hạ 1 bậc; thấp nhất là Bạc.',
      note: 'Dựa trên Điểm · Chu kỳ 1 năm'
    }
  ];

  readonly ranks = [
    {
      name: 'CHƯA ĐẠT HẠNG',
      requirement: 'Dưới 1.000 KÉN ĐIỂM',
      icon: 'circle.svg',
      tone: 'unranked',
      checkIcon: '',
      perks: [
        'Tích KÉN ĐIỂM mỗi giao dịch',
        'Sử dụng KÉN Coins đổi quà',
        'Chưa có ưu đãi giảm giá'
      ]
    },
    {
      name: 'BẠC',
      requirement: 'Từ 1.000 KÉN ĐIỂM',
      icon: 'silver-star.svg',
      tone: 'silver',
      checkIcon: 'silver-check.svg',
      perks: [
        'Giảm 5% tổng hóa đơn',
        'Coins đổi voucher/quà'
      ]
    },
    {
      name: 'VÀNG',
      requirement: 'Từ 5.000 KÉN ĐIỂM',
      icon: 'gold-star.svg',
      tone: 'gold',
      checkIcon: 'gold-check.svg',
      perks: [
        'Giảm 10% tổng hóa đơn',
        'Coins đổi voucher/quà',
        'Ưu đãi sinh nhật'
      ]
    },
    {
      name: 'KIM CƯƠNG',
      requirement: 'Từ 10.000 KÉN ĐIỂM',
      icon: 'diamond.svg',
      tone: 'diamond',
      checkIcon: 'diamond-check.svg',
      perks: [
        'Giảm 15% tổng hóa đơn',
        'Coins đổi voucher/quà',
        'Đổi Coins không giảm hạng',
        'Hỗ trợ 1900 123 456'
      ]
    }
  ];

  readonly steps = [
    {
      number: '1',
      title: 'Đặt chỗ tại KÉN',
      description: 'Chọn không gian, gói và thời gian phù hợp. Xác nhận và thanh toán để hoàn tất.'
    },
    {
      number: '2',
      title: 'Trải nghiệm dịch vụ',
      description: 'Đến KÉN, check-in và tận hưởng không gian. KÉN ghi nhận giao dịch của bạn.'
    },
    {
      number: '3',
      title: 'Nhận KÉN ĐIỂM & Coins',
      description: 'Điểm và Coins được cộng sau khi hoàn thành dịch vụ. Kiểm tra trong tài khoản của bạn.'
    }
  ];

  readonly questions = [
    {
      question: 'KÉN ĐIỂM là gì?',
      answer: '10.000đ chi tiêu hợp lệ = 1 KÉN ĐIỂM. Điểm dùng để xét hạng thành viên, không quy ra tiền hoặc đổi quà.'
    },
    {
      question: 'Tôi tích KÉN ĐIỂM như thế nào?',
      answer: '10.000đ chi tiêu hợp lệ tại KÉN = 1 KÉN ĐIỂM và 1 Coin. Điểm được cộng sau khi hoàn thành dịch vụ.'
    },
    {
      question: 'KÉN ĐIỂM có hết hạn không?',
      answer: 'Thông tin về thời hạn của từng Điểm đang chờ xác nhận chính sách.'
    },
    {
      question: 'Khi nào KÉN ĐIỂM được thêm vào tài khoản?',
      answer: 'Điểm và Coins được cộng sau khi hoàn thành dịch vụ.'
    },
    {
      question: 'Nếu tôi huỷ hoặc đổi lịch đặt chỗ thì điểm tính sao?',
      answer: 'Giao dịch bị huỷ hoặc hoàn tiền sẽ được điều chỉnh Điểm và Coins tương ứng.'
    },
    {
      question: 'KÉN ĐIỂM và KÉN Coins khác nhau như thế nào? Tôi có thể chuyển đổi qua lại không?',
      answer: 'KÉN ĐIỂM dùng để xét hạng, còn KÉN Coins dùng để đổi voucher và quà. Quy tắc chuyển đổi giữa hai loại đang chờ xác nhận.'
    },
    {
      question: 'Việc sử dụng mã giảm giá có ảnh hưởng đến KÉN ĐIỂM tôi tích được không?',
      answer: 'Cách tính Điểm khi sử dụng mã giảm giá đang chờ xác nhận chính sách.'
    }
  ];

  activeTab: 'points' | 'steps' | 'terms' = 'points';
  openQuestion: number | null = null;

  selectTab(tab: 'points' | 'steps' | 'terms'): void {
    this.activeTab = tab;
    this.openQuestion = null;
  }

  toggleQuestion(index: number): void {
    this.openQuestion =
      this.openQuestion === index ? null : index;
  }
}
