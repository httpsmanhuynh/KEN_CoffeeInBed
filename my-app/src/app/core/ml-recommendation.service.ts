import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface MlRecommendationItem {
  id: string; // product id hoặc extra id
  name: string;
  category: string;
  price: number;
  image: string;
  type: 'drink' | 'pastry' | 'extra';
  matchScore: number; // Điểm tương thích dự đoán bởi ML (ví dụ 98%)
  reason: string; // Lý do gợi ý giải thích từ thuật toán ML
  tag: string; // Huy hiệu ML (ví dụ: "🤖 Gợi ý AI", "⚡ Siêu tập trung")
  benefits?: string[];
}

export interface MlBookingContext {
  spaceId: string;
  date?: string;
  startHour: number;
  hours: number;
  guests?: number;
}

@Injectable({ providedIn: 'root' })
export class MlRecommendationService {
  /**
   * Trả về danh sách gợi ý từ thuật toán Machine Learning.
   * Hiện tại sử dụng dữ liệu giả định mô phỏng (Mock Data) theo thời gian & thói quen người dùng.
   * Sẵn sàng tích hợp API thực tế khi bài toán Machine Learning hoàn tất.
   */
  getRecommendations(context: MlBookingContext): Observable<MlRecommendationItem[]> {
    const items = this.computeMockRecommendations(context);
    return of(items);
  }

  /**
   * Placeholder để cắm API Machine Learning thực tế sau này.
   * Ví dụ:
   * return this.http.post<MlRecommendationItem[]>('/api/ml/recommend', context);
   */
  async fetchFromExternalMlApi(context: MlBookingContext): Promise<MlRecommendationItem[]> {
    // Khi bạn cung cấp API / endpoint của bài toán Machine Learning (Python/Flask/FastAPI/Node),
    // bạn chỉ cần bật đoạn code fetch này:
    /*
    const response = await fetch('/api/ml/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context)
    });
    return await response.json();
    */
    return this.computeMockRecommendations(context);
  }

  computeMockRecommendations(context: MlBookingContext): MlRecommendationItem[] {
    const hour = Number(context.startHour) || 9;
    const duration = Number(context.hours) || 1;

    // Phân tích ngữ cảnh theo khung giờ: Sáng (8-11h), Trưa - Chiều (12-16h), Tối (17-22h)
    if (hour >= 8 && hour < 12) {
      return [
        {
          id: 'cold-brew',
          name: 'Cold Brew Truyền thống / Trái cây',
          category: 'Cà phê',
          price: 50000,
          image: 'cold-brew.png',
          type: 'drink',
          matchScore: 98,
          reason: 'Mô hình ML dự đoán: 94% khách hàng đặt phiên sáng chọn Cold Brew để duy trì tỉnh táo đỉnh cao.',
          tag: '⚡ Năng lượng buổi sáng',
          benefits: ['Chiết xuất lạnh 16h', 'Tỉnh táo êm dịu không say cồn cào']
        },
        {
          id: 'croissant',
          name: 'Bánh sừng bò (Croissant) cơ bản',
          category: 'Bánh & ăn nhẹ',
          price: 35000,
          image: 'croissant.png',
          type: 'pastry',
          matchScore: 94,
          reason: 'Cặp đôi hoàn hảo cùng cà phê sáng, nạp năng lượng nhẹ nhàng không gây buồn ngủ.',
          tag: '🥐 Bữa sáng nhẹ',
          benefits: ['Bơ Pháp thơm lừng', 'Vỏ giòn ruột mềm']
        },
        {
          id: 'americano',
          name: 'Americano',
          category: 'Cà phê',
          price: 40000,
          image: 'americano.png',
          type: 'drink',
          matchScore: 91,
          reason: 'Vị cà phê đậm đà mộc mạc, kích hoạt sự tập trung giải quyết công việc đầu ngày.',
          tag: '🎯 Tập trung cao độ',
          benefits: ['Arabica Cầu Đất', 'Không đường, thanh sạch']
        }
      ];
    } else if (hour >= 12 && hour < 17) {
      return [
        {
          id: 'matcha',
          name: 'Matcha Latte / Hojicha Latte',
          category: 'Trà & latte',
          price: 55000,
          image: 'matcha.png',
          type: 'drink',
          matchScore: 99,
          reason: 'Dự đoán theo khung giờ chiều: Hoạt chất L-theanine giúp giải tỏa stress và chống uể oải giờ xế chiều.',
          tag: '🌿 Chống mỏi mệt chiều',
          benefits: ['Matcha Uji Nhật Bản', 'Êm dịu tinh thần']
        },
        {
          id: 'tiramisu',
          name: 'Tiramisu / Cheesecake',
          category: 'Bánh & ăn nhẹ',
          price: 50000,
          image: 'tiramisu.png',
          type: 'pastry',
          matchScore: 95,
          reason: 'Gợi ý kích thích tư duy sáng tạo: Vị ngọt dịu và cacao giúp tái tạo sự tập trung sau 2h làm việc.',
          tag: '🍰 Ngọt ngào xế chiều',
          benefits: ['Kem Mascarpone Ý', 'Cacao nguyên chất']
        },
        {
          id: 'bac-xiu',
          name: 'Bạc Xỉu / Salted Caramel Coffee',
          category: 'Cà phê',
          price: 45000,
          image: 'bac-xiu.png',
          type: 'drink',
          matchScore: 92,
          reason: 'Vị ngọt thanh và sữa ngậy giúp lấy lại hứng khởi nhanh chóng giữa ca làm việc.',
          tag: '✨ Lấy lại cảm hứng',
          benefits: ['Cà phê & caramel muối', 'Dễ uống, sảng khoái']
        }
      ];
    } else {
      // Khung giờ tối: 17h - 22h
      return [
        {
          id: 'oolong',
          name: 'Trà Oolong Macchiato / Trà Đào',
          category: 'Trà & latte',
          price: 50000,
          image: 'oolong.png',
          type: 'drink',
          matchScore: 97,
          reason: 'Thuật toán tối ưu cho buổi tối: Ít caffein, thanh nhẹ, giúp thư giãn đầu óc và ngủ ngon sau đó.',
          tag: '🌙 Thư giãn tối muộn',
          benefits: ['Oolong tuyển chọn', 'Thanh mát, nhẹ bụng']
        },
        {
          id: 'sandwich',
          name: 'Sandwich',
          category: 'Bánh & ăn nhẹ',
          price: 45000,
          image: 'sandwich.png',
          type: 'pastry',
          matchScore: 93,
          reason: 'Lót dạ bữa tối gọn gàng tiện lợi, không làm gián đoạn dòng suy nghĩ chạy deadline đêm.',
          tag: '🥪 Nạp năng lượng tối',
          benefits: ['Bánh mì lúa mạch', 'Đầy đủ dinh dưỡng']
        },
        {
          id: 'juice',
          name: 'Nước cam / Nước ép chanh dây',
          category: 'Giải khát',
          price: 45000,
          image: 'juice.png',
          type: 'drink',
          matchScore: 90,
          reason: 'Bổ sung vitamin C tự nhiên, phục hồi thể lực sau ngày dài học tập và làm việc căng thẳng.',
          tag: '🍊 Phục hồi năng lượng',
          benefits: ['100% trái cây tươi', 'Tươi mát sảng khoái']
        }
      ];
    }
  }

  /**
   * Gợi ý Add-ons (tiện ích + đồ uống + bánh) chuyên biệt cho bước chọn Add-ons của Focus Pod.
   */
  getFocusPodAddonRecommendations(context: MlBookingContext): MlRecommendationItem[] {
    const duration = Number(context.hours) || 1;
    const hour = Number(context.startHour) || 9;

    const results: MlRecommendationItem[] = [];

    // Nếu thời lượng >= 2h hoặc 4h -> ML đề xuất tiện ích hỗ trợ công việc
    if (duration >= 2) {
      results.push({
        id: 'extra-monitor',
        name: 'Màn hình mở rộng 24” FHD',
        category: 'Tiện ích',
        price: 50000,
        image: 'monitor.png',
        type: 'extra',
        matchScore: 96,
        reason: `Mô hình nhận diện phiên làm việc ${duration} giờ: Tăng 45% năng suất với không gian hiển thị kép.`,
        tag: '💻 Tăng tốc công việc',
        benefits: ['Tần số quét cao', 'Cổng Type-C & HDMI tiện lợi']
      });
    }

    if (hour >= 13) {
      results.push({
        id: 'extra-matcha',
        name: 'Matcha Latte Uji Thượng Hạng',
        category: 'Đồ uống',
        price: 55000,
        image: 'matcha.png',
        type: 'extra',
        matchScore: 95,
        reason: 'Khuyên dùng cho buổi chiều: Duy trì trạng thái tập trung sâu (Deep Work) liên tục.',
        tag: '🌿 Deep Work Boost',
        benefits: ['Hương vị êm đượm', 'Giải tỏa áp lực']
      });
    } else {
      results.push({
        id: 'extra-coffee',
        name: 'Cà phê Đen / Sữa Rang Mộc',
        category: 'Đồ uống',
        price: 40000,
        image: 'coffee.png',
        type: 'extra',
        matchScore: 94,
        reason: 'Lựa chọn hàng đầu cho ca làm việc sáng của 89% khách hàng cá nhân.',
        tag: '⚡ Tỉnh táo tức thì',
        benefits: ['Hạt cà phê nguyên chất', 'Hương thơm nồng nàn']
      });
    }

    results.push({
      id: 'extra-croissant',
      name: 'Bánh sừng bò (Croissant) Bơ Pháp',
      category: 'Bánh ngọt',
      price: 35000,
      image: 'croissant.png',
      type: 'extra',
      matchScore: 91,
      reason: 'Bổ sung calo sạch giúp não bộ duy trì khả năng tư duy logic và giải quyết vấn đề.',
      tag: '🥐 Lót dạ lý tưởng',
      benefits: ['Nướng nóng giòn', 'Thơm bơ tự nhiên']
    });

    results.push({
      id: 'extra-phone',
      name: 'Cáp sạc & Pin sạc dự phòng đa năng',
      category: 'Tiện ích',
      price: 20000,
      image: 'powerbank.png',
      type: 'extra',
      matchScore: 88,
      reason: 'Giữ kết nối thông suốt mọi thiết bị điện thoại, máy tính bảng trong suốt thời gian đặt ô.',
      tag: '🔋 Luôn đầy pin',
      benefits: ['Hỗ trợ sạc nhanh', 'Đa dạng đầu cáp']
    });

    return results;
  }
}
