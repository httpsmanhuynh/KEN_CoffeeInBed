import { Component } from '@angular/core';

@Component({
  selector: 'app-coins-page',
  standalone: false,
  templateUrl: './coins-page.html',
  styleUrl: './coins-page.css'
})
export class CoinsPage {
  readonly concepts = [
    {
      name: 'KÉN Điểm',
      icon: 'receipt.svg',
      description: 'Tích lũy từ chi tiêu · dùng để xét thăng Hạng thành viên. Không đổi trực tiếp lấy quà.',
      note: 'Xét hạng thành viên',
      highlight: false
    },
    {
      name: 'KÉN Coins',
      icon: 'wallet-highlight.svg',
      description: '10.000đ = 1 Coin. Dùng đổi quà và voucher. Không ảnh hưởng Hạng. Hết 1 năm về 0.',
      note: 'Đổi quà · Voucher',
      highlight: true
    },
    {
      name: 'Hạng thành viên',
      icon: 'gift-fill.svg',
      description: 'Dựa trên KÉN Điểm tích lũy. Đổi Coins không làm giảm Hạng. Mỗi hạng có đặc quyền riêng.',
      note: 'Đặc quyền · Ưu tiên',
      highlight: false
    }
  ];

  readonly earnMethods = [
    {
      title: 'KÉN Kết Nối',
      icon: 'clock.svg',
      description: 'Ghé cà phê, đọc sách và gặp bạn bè. Tích Coins từ mỗi lần chi tiêu tại quầy.',
      note: 'ghé trực tiếp · Không đặt'
    },
    {
      title: 'KÉN Tập Trung',
      icon: 'calendar.svg',
      description: 'Work Lounge, Focus Pod và phòng họp theo giờ. Tích Coins khi đặt chỗ và hoàn tất dịch vụ.',
      note: 'Work Lounge · Focus Pod'
    },
    {
      title: 'KÉN Tái Tạo',
      icon: 'gift-fill.svg',
      description: 'Single Bed Pod, Double Bed Pod và Private Studio theo giờ. Nạp lại năng lượng và tích Coins.',
      note: 'Pod · Studio theo giờ'
    }
  ];

  readonly rewards = [
    {
      title: 'Quà lưu niệm KÉN độc quyền',
      description: 'Móc khoá, sổ tay, túi canvas in logo KÉN',
      icon: 'gift.svg'
    },
    {
      title: 'Voucher giảm giá dịch vụ KÉN',
      description: 'Áp dụng khi đặt chỗ · chỉ trừ Coins, giữ nguyên Điểm',
      icon: 'wallet.svg'
    },
    {
      title: 'Ưu đãi khả dụng trong tài khoản',
      description: 'Đăng nhập để xem và dùng ngay',
      icon: 'clock-history.svg'
    }
  ];

  readonly steps = [
    {
      number: 1,
      title: 'Đăng nhập KÉN',
      description: 'Đăng nhập vào tài khoản KÉN của bạn'
    },
    {
      number: 2,
      title: 'Xem ví & lịch sử',
      description: 'Vào mục Coins để xem số dư và lịch sử giao dịch'
    },
    {
      number: 3,
      title: 'Chọn ưu đãi',
      description: 'Đọc mức Coins, điều kiện và hạn dùng trước khi xác nhận'
    },
    {
      number: 4,
      title: 'Xác nhận đổi',
      description: 'Xác nhận giao dịch · Coins trừ ngay, ưu đãi vào tài khoản'
    }
  ];

  readonly faqs = [
    {
      question: 'KÉN Coins và KÉN ĐIỂM khác nhau như thế nào?',
      answer: 'KÉN Điểm dùng để xét hạng thành viên. KÉN Coins dùng để đổi voucher và quà. Hai loại tích lũy độc lập.'
    },
    {
      question: 'Đổi Coins có làm giảm KÉN ĐIỂM hoặc hạng thành viên không?',
      answer: 'Không. Đổi Coins không làm giảm KÉN Điểm hoặc hạng thành viên.'
    },
    {
      question: 'Coins hết chu kỳ 1 năm sẽ được đặt về 0 như thế nào?',
      answer: 'Theo nội dung Figma, khi hết chu kỳ 1 năm, số dư Coins còn lại về 0. Thời điểm chốt chu kỳ cần được xác nhận trong điều khoản chính thức.'
    },
    {
      question: 'Coins được ghi nhận ngay sau khi dùng dịch vụ không?',
      answer: 'Coins được cộng sau khi hoàn tất dịch vụ.'
    },
    {
      question: 'Nếu phát hiện sai lệch số dư Coins, tôi cần làm gì?',
      answer: 'Bạn có thể liên hệ Trung tâm hỗ trợ để yêu cầu kiểm tra số dư và lịch sử giao dịch.'
    },
    {
      question: 'Coins có được hoàn lại khi hủy giao dịch không?',
      answer: 'Theo nội dung Figma, giao dịch lỗi không trừ số dư. Quy tắc hoàn Coins khi hủy một giao dịch thành công cần được xác nhận thêm.'
    },
    {
      question: 'Tôi có thể chuyển Coins sang người khác không?',
      answer: 'Chính sách chuyển Coins giữa các tài khoản chưa được xác nhận. Vui lòng tham khảo điều khoản hoặc liên hệ Trung tâm hỗ trợ.'
    },
    {
      question: 'Làm thế nào để xem lịch sử giao dịch Coins?',
      answer: 'Đăng nhập vào tài khoản KÉN, vào mục Coins để xem số dư và lịch sử giao dịch.'
    },
    {
      question: 'Có giới hạn số lần đổi Coins trong một tháng không?',
      answer: 'Thông tin giới hạn số lần đổi Coins chưa được xác nhận trong thiết kế. Hãy xem điều kiện của từng ưu đãi.'
    }
  ];

  openFaq: number | null = null;

  toggleFaq(index: number): void {
    this.openFaq = this.openFaq === index ? null : index;
  }
}
