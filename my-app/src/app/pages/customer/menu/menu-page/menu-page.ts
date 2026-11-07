import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SuggestionPopupService } from '../../../../shared/services/suggestion-popup.service';

/**
 * Trang Menu tạm: Figma chưa có thiết kế Menu đầy đủ, trang này chỉ làm điểm đến cho
 * "Để sau, mình xem Menu" / "Quay về Menu" và nơi popup gợi ý buổi chiều xuất hiện.
 * TODO: thay bằng trang Menu thật khi có thiết kế.
 */
@Component({
  selector: 'app-menu-page',
  standalone: false,
  templateUrl: './menu-page.html',
  styleUrl: './menu-page.css',
})
export class MenuPage implements OnInit {
  private readonly popup = inject(SuggestionPopupService);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    // Tự mở 1 lần/phiên vào khung 14:00–17:00; thêm ?popup=1 để xem thử ở giờ khác.
    this.popup.autoShow(this.route.snapshot.queryParamMap.get('popup') === '1');
  }

  openSuggestion(): void { this.popup.show(); }
}
