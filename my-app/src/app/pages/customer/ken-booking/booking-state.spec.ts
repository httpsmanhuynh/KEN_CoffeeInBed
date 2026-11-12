import { KenBookingState } from './booking-state';

describe('KenBookingState', () => {
  it('calculates booking totals and required drinks for a four-person private room', () => {
    const state = new KenBookingState();
    state.set({ spaceId: 'private', guests: 4, hours: 4 });

    expect(state.base).toBe(480000);
    expect(state.requiredDrinkCount).toBe(4);
    state.setDrinkQuantity('coffee', 2);
    state.setDrinkQuantity('water', 2);
    state.setExtra('extra-croissant', 1);

    expect(state.selectedDrinkCount).toBe(4);
    expect(state.drinkSurcharge).toBe(0);
    expect(state.extrasTotal).toBe(35000);
    expect(state.subtotal).toBe(515000);
  });

  it('keeps the Focus Pod package pricing and single drink entitlement', () => {
    const state = new KenBookingState();

    expect(state.base).toBe(140000);
    expect(state.requiredDrinkCount).toBe(1);
    expect(state.drinkSurcharge).toBe(5000);
  });

  it('requires one drink per guest for two-person spaces', () => {
    const state = new KenBookingState();
    state.set({ spaceId: 'double', guests: 2 });

    expect(state.requiredDrinkCount).toBe(2);
    state.setDrinkQuantity('coffee', 2);
    expect(state.selectedDrinkCount).toBe(2);
    state.setDrinkQuantity('matcha', 1);
    expect(state.drinkSurcharge).toBe(5000);
  });

  it('preserves selected guest count when entering a compatible space and caps included drinks at one per guest', () => {
    const state = new KenBookingState();
    state.set({ guests: 4 });
    state.set({ spaceId: 'private' });

    expect(state.draft().guests).toBe(4);
    expect(state.requiredDrinkCount).toBe(4);
    expect(state.entitlement).toBe(50000);
    state.setDrinkQuantity('matcha', 4);
    expect(state.drinkSurcharge).toBe(20000);
  });

  it('clamps a guest count to the selected space capacity', () => {
    const state = new KenBookingState();
    state.set({ spaceId: 'meeting-large' });

    expect(state.draft().guests).toBe(6);
    expect(state.requiredDrinkCount).toBe(6);
    expect(state.entitlement).toBe(50000);
  });

  it('does not multiply included drinks for the all-day work package', () => {
    const state = new KenBookingState();
    state.set({ spaceId: 'work', guests: 2, hours: 14 });

    expect(state.requiredDrinkCount).toBe(2);
    expect(state.entitlement).toBe(50000);
  });

  it('allows optional paid drinks when the Focus Pod package has no included drink', () => {
    const state = new KenBookingState();
    state.set({ hours: 1 });
    state.setDrinkQuantity('matcha', 1);

    expect(state.requiredDrinkCount).toBe(0);
    expect(state.selectedDrinkCount).toBe(1);
    expect(state.drinkSurcharge).toBe(55000);
  });
});
