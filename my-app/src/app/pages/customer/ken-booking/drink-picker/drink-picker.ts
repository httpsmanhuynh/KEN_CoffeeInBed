import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { KenBookingState, kenMoney } from '../booking-state';

@Component({ selector: 'app-ken-drink-picker', standalone: false, templateUrl: './drink-picker.html', styleUrl: './drink-picker.css' })
export class KenDrinkPickerPage {
  searchText = '';
  category: 'all' | 'coffee' | 'refreshment' = 'all';
  extraOnly = false;
  sorting: 'default' | 'price-asc' | 'price-desc' = 'default';
  feedback = '';
  readonly money = kenMoney;
  constructor(
    public state: KenBookingState,
    private router: Router,
    private route: ActivatedRoute,
  ) {}
  get filteredDrinks() {
    let arr = this.state.drinks.filter(d =>
      (this.category === 'all' || d.category === this.category) &&
      (!this.extraOnly || d.price > this.state.entitlement) &&
      d.name.toLocaleLowerCase('vi-VN').includes(this.searchText.trim().toLocaleLowerCase('vi-VN'))
    );
    if (this.sorting !== 'default') arr = [...arr].sort((a, b) => this.sorting === 'price-asc' ? a.price - b.price : b.price - a.price);
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
  select(id: string): void {
    if (this.state.drinkQuantity(id) === 0 &&
        !this.canAddDrink) return;
    this.state.setDrinkQuantity(id, this.state.drinkQuantity(id) + 1);
    this.feedback = '';
  }
  changeDrink(id: string, delta: number): void {
    if (delta > 0 && !this.canAddDrink) return;
    this.state.setDrinkQuantity(id, this.state.drinkQuantity(id) + delta);
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
