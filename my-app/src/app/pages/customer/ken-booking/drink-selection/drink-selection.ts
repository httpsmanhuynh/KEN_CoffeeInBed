import { Component } from '@angular/core';
import { KenBookingState, kenMoney } from '../booking-state';

@Component({
  selector: 'app-ken-drink-selection',
  standalone: false,
  templateUrl: './drink-selection.html',
  styleUrl: './drink-selection.css',
})
export class KenDrinkSelectionComponent {
  readonly money = kenMoney;

  constructor(public state: KenBookingState) {
    this.state.loadClusterRecommendations(true);
  }

  get drinks() {
    return this.state.drinks;
  }

  get canAddDrink(): boolean {
    return this.state.selectedDrinkCount <
      (this.state.requiredDrinkCount || 9);
  }

  drinkCount(id: string): number {
    return this.state.drinkQuantity(id);
  }

  changeDrink(id: string, delta: number): void {
    this.state.setDrinkQuantity(id, this.drinkCount(id) + delta);
  }

  drinkTopUp(price: number): number {
    return Math.max(0, price - this.state.entitlement);
  }
}
