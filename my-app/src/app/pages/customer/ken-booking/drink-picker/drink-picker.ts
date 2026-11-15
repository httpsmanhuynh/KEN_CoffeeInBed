import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { KenBookingState, kenMoney } from '../booking-state';
import { MlRecommendationItem, MlRecommendationService } from '../../../../core/ml-recommendation.service';

@Component({
  selector: 'app-ken-drink-picker',
  standalone: false,
  templateUrl: './drink-picker.html',
  styleUrl: './drink-picker.css'
})
export class KenDrinkPickerPage implements OnInit {
  searchText = '';
  category: 'all' | 'coffee' | 'refreshment' = 'all';
  extraOnly = false;
  sorting: 'default' | 'price-asc' | 'price-desc' = 'default';
  feedback = '';
  recommendations: MlRecommendationItem[] = [];
  readonly money = kenMoney;

  constructor(
    public state: KenBookingState,
    private router: Router,
    private route: ActivatedRoute,
    private mlRecService?: MlRecommendationService,
  ) {
    if (!this.mlRecService) {
      this.mlRecService = new MlRecommendationService();
    }
  }

  ngOnInit(): void {
    this.loadRecommendations();
  }

  loadRecommendations(): void {
    const draft = this.state.draft();
    if (this.mlRecService) {
      this.recommendations = this.mlRecService.computeMockRecommendations({
        spaceId: draft.spaceId,
        date: draft.date,
        startHour: draft.startHour,
        hours: draft.hours,
        guests: draft.guests
      });
    }
  }

  get filteredDrinks() {
    let arr = this.state.drinks.filter(d =>
      (this.category === 'all' || d.category === this.category) &&
      (!this.extraOnly || d.price > this.state.entitlement) &&
      d.name.toLocaleLowerCase('vi-VN').includes(this.searchText.trim().toLocaleLowerCase('vi-VN'))
    );
    if (this.sorting !== 'default') {
      arr = [...arr].sort((a, b) => this.sorting === 'price-asc' ? a.price - b.price : b.price - a.price);
    }
    return arr;
  }

  get coffee() { return this.filteredDrinks.filter(d => d.category === 'coffee'); }
  get refreshments() { return this.filteredDrinks.filter(d => d.category === 'refreshment'); }
  get isFocusSpace(): boolean { return this.state.isFocusSpace; }
  get selectedDrinkCount(): number { return this.state.selectedDrinkCount; }

  get canContinue(): boolean {
    return this.state.requiredDrinkCount === 0 ||
      this.selectedDrinkCount === this.state.requiredDrinkCount;
  }

  get canAddDrink(): boolean {
    return this.selectedDrinkCount < (this.state.requiredDrinkCount || 9);
  }

  get canAddPastry(): boolean {
    return this.state.selectedPastryCount < this.state.requiredPastryCount;
  }

  getRecommendedQty(item: MlRecommendationItem): number {
    if (item.type === 'drink') {
      return this.state.drinkQuantity(item.id);
    } else if (item.type === 'pastry') {
      return this.state.pastryQuantity(item.id);
    }
    return 0;
  }

  selectRecommended(item: MlRecommendationItem): void {
    if (item.type === 'drink') {
      if (this.canAddDrink) {
        this.changeDrink(item.id, 1);
      }
    } else if (item.type === 'pastry') {
      if (this.canAddPastry) {
        this.changePastry(item.id, 1);
      }
    }
  }

  select(id: string): void {
    if (this.state.drinkQuantity(id) === 0 && !this.canAddDrink) return;
    this.state.setDrinkQuantity(id, this.state.drinkQuantity(id) + 1);
    this.feedback = '';
  }

  changeDrink(id: string, delta: number): void {
    if (delta > 0 && !this.canAddDrink) return;
    this.state.setDrinkQuantity(id, this.state.drinkQuantity(id) + delta);
    this.feedback = '';
  }

  changePastry(id: string, delta: number): void {
    if (delta > 0 && !this.canAddPastry) return;
    this.state.setPastryQuantity(id, this.state.pastryQuantity(id) + delta);
    this.feedback = '';
  }

  back(): void {
    if (!this.canContinue) {
      this.feedback = `Chọn đủ ${this.state.requiredDrinkCount} đồ uống để tiếp tục.`;
      return;
    }
    const returnTo = this.route.snapshot.queryParamMap.get('returnTo');
    if (returnTo?.startsWith('/booking/') && !returnTo.startsWith('//')) {
      this.router.navigateByUrl(returnTo);
      return;
    }
    this.router.navigateByUrl(this.isFocusSpace ? '/booking/focus-pod' : `/booking/${this.state.draft().spaceId}`);
  }
}
