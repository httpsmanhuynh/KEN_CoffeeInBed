import { KenBookingState } from './booking-state';

describe('KenBookingState', () => {
  beforeEach(() => localStorage.clear());

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

  it('requires one drink per guest for two-person 2h spaces', () => {
    const state = new KenBookingState();
    state.set({ spaceId: 'double', guests: 2, hours: 2 });

    expect(state.requiredDrinkCount).toBe(2);
    state.setDrinkQuantity('coffee', 2);
    expect(state.selectedDrinkCount).toBe(2);
    state.setDrinkQuantity('matcha', 1);
    expect(state.drinkSurcharge).toBe(5000);
  });

  it('preserves selected guest count when entering a compatible space and caps included drinks at one per guest on 4h packages', () => {
    const state = new KenBookingState();
    state.set({ guests: 4 });
    state.set({ spaceId: 'private', hours: 4 });

    expect(state.draft().guests).toBe(4);
    expect(state.requiredDrinkCount).toBe(4);
    expect(state.entitlement).toBe(50000);
    state.setDrinkQuantity('matcha', 4);
    expect(state.drinkSurcharge).toBe(20000);
  });

  it('gives fixed projector, whiteboard, and one water bottle per guest for meeting rooms without selectable drinks', () => {
    const state = new KenBookingState();
    state.set({ spaceId: 'meeting-small', guests: 3 });

    expect(state.draft().guests).toBe(3);
    expect(state.requiredDrinkCount).toBe(0);
    expect(state.requiredPastryCount).toBe(0);
    expect(state.freeWaterCount).toBe(3);
    expect(state.fixedEquipment).toEqual(['Máy chiếu', 'Bảng từ']);
    expect(state.packageName).toBe('Họp nhóm nhỏ (3 giờ)');
    expect(state.selectedDrinks.length).toBe(0);

    state.set({ spaceId: 'meeting-large' });
    expect(state.draft().guests).toBe(6);
    expect(state.requiredDrinkCount).toBe(0);
    expect(state.freeWaterCount).toBe(6);
    expect(state.packageName).toBe('Họp nhóm lớn (3 giờ)');
  });

  it('includes two drinks and one pastry per guest for the all-day work package and respects hourly rules', () => {
    const state = new KenBookingState();
    state.set({ spaceId: 'work', guests: 2, hours: 14 });

    expect(state.packageName).toBe('Gói Cả ngày');
    expect(state.requiredDrinkCount).toBe(4);
    expect(state.requiredPastryCount).toBe(2);
    expect(state.entitlement).toBe(50000);

    state.set({ hours: 2 });
    expect(state.packageName).toBe('Gói Linh hoạt');
    expect(state.requiredDrinkCount).toBe(0);
    expect(state.freeWaterCount).toBe(2);
  });

  it('applies exact Report inclusions across rest durations (1h, 2h, 4h, 8h) and caps PER_BOOKING extras at 1', () => {
    const state = new KenBookingState();
    state.set({ spaceId: 'double', guests: 2, hours: 1 });
    expect(state.requiredDrinkCount).toBe(0);
    expect(state.requiredPastryCount).toBe(0);

    state.set({ hours: 2 });
    expect(state.requiredDrinkCount).toBe(2);
    expect(state.requiredPastryCount).toBe(0);

    state.set({ hours: 4 });
    expect(state.requiredDrinkCount).toBe(2);
    expect(state.requiredPastryCount).toBe(2);

    state.set({ hours: 8 });
    expect(state.requiredDrinkCount).toBe(4);
    expect(state.requiredPastryCount).toBe(2);

    state.setExtra('extra-monitor', 3);
    expect(state.draft().extras['extra-monitor']).toBe(1);
    state.setExtra('extra-croissant', 3);
    expect(state.draft().extras['extra-croissant']).toBe(3);
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
