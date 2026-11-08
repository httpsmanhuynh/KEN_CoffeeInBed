import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { KenBookingState, kenMoney } from '../booking-state';

@Component({ selector: 'app-ken-drink-picker', standalone: false, templateUrl: './drink-picker.html', styleUrl: './drink-picker.css' })
export class KenDrinkPickerPage {
  searchText = '';
  category: 'all' | 'coffee' | 'refreshment' = 'all';
  extraOnly = false;
  sorting: 'default' | 'price-asc' | 'price-desc' = 'default';
  readonly money = kenMoney;
  constructor(public state: KenBookingState, private router: Router) {}
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
  select(id: string): void { this.state.set({ drinkId: id }); }
  back(): void { this.router.navigateByUrl('/booking/focus-pod'); }
}
