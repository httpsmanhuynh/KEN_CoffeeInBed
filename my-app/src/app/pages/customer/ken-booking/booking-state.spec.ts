import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
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

  it('supports hot/cold variants and size selection only for Matcha Latte and Hojicha Latte (M = 55k, L = 60k)', () => {
    const state = new KenBookingState();
    // Default Focus Pod 4h has 1 included drink, default drink is matcha
    expect(state.requiredDrinkCount).toBe(1);
    expect(state.isSizeSelectable({ id: 'matcha' })).toBe(true);
    expect(state.isSizeSelectable({ id: 'hojicha' })).toBe(true);
    expect(state.isSizeSelectable({ id: 'coffee' })).toBe(false);

    // Default matcha is Size M (55k) -> surcharge is 55000 - 50000 = 5000
    expect(state.getDrinkVariant('matcha')).toBe('Lạnh, M (500 ml)');
    expect(state.drinkSurcharge).toBe(5000);

    // Change size to L -> price becomes 60k -> surcharge is 60000 - 50000 = 10000
    state.setDrinkSize('matcha', 'L');
    expect(state.getDrinkVariant('matcha')).toBe('Lạnh, L (700 ml)');
    expect(state.drinkSurcharge).toBe(10000);

    // Switch temperature to Nóng -> variant is Nóng, L (700 ml)
    state.setDrinkTemp('matcha', 'Nóng');
    expect(state.getDrinkVariant('matcha')).toBe('Nóng, L (700 ml)');
    expect(state.drinkSurcharge).toBe(10000);

    // Switch to Size M -> 55k
    state.setDrinkSize('matcha', 'M');
    expect(state.getDrinkVariant('matcha')).toBe('Nóng, M (500 ml)');
    expect(state.drinkSurcharge).toBe(5000);

    // Normal drink (coffee) supports hot/cold but no size
    state.setDrinkQuantity('matcha', 0);
    state.setDrinkQuantity('coffee', 1);
    expect(state.drinkSurcharge).toBe(0);
    state.setDrinkTemp('coffee', 'Nóng');
    expect(state.getDrinkVariant('coffee')).toBe('Nóng');
    state.setDrinkTemp('coffee', 'Lạnh');
    expect(state.getDrinkVariant('coffee')).toBe('Lạnh');
    expect(state.drinkSurcharge).toBe(0);
  });

  it('resolves cluster recommendation items for inclusion and add-on bars', () => {
    const state = new KenBookingState();
    state.set({ spaceId: 'work', guests: 1, hours: 14 });
    state.clusterRecSignal.set({
      clusterId: 0,
      personaName: 'Khách thân thiết chi mạnh',
      items: [
        {
          rank: 1,
          itemCode: 'CF_SUA',
          productId: 'prod-cf-sua',
          addonId: 'addon-cf-sua',
          name: 'Cà phê sữa',
          addonName: 'Cà phê sữa',
          category: 'DRINK',
          price: 50000,
          addonPrice: 50000,
        },
        {
          rank: 2,
          itemCode: 'BAKE_CROISSANT',
          productId: 'prod-croissant',
          addonId: 'addon-croissant',
          name: 'Croissant bơ',
          addonName: 'Croissant bơ',
          category: 'PASTRY',
          price: 35000,
          addonPrice: 35000,
        },
      ],
    });

    expect(state.clusterId).toBe(0);
    expect(state.clusterPersona).toBe('Khách thân thiết chi mạnh');
    expect(state.clusterRecInclusionDrinks.map(p => p.itemCode)).toContain('CF_SUA');
    expect(state.clusterRecInclusionPastries.map(p => p.itemCode)).toContain('BAKE_CROISSANT');
    expect(state.clusterRecInclusionItems.length).toBe(2);
    expect(state.clusterRecExtras.map(e => e.itemCode)).toEqual(['CF_SUA', 'BAKE_CROISSANT']);

    const cfSua = state.clusterRecInclusionDrinks[0];
    const croissant = state.clusterRecInclusionPastries[0];
    // Simulate merging fallback items into menu/extras just as loadClusterRecommendations does
    state.menuProductsSignal.set([...state.menuProductsSignal(), cfSua]);
    state.addInclusionItem(cfSua, 1);
    state.addInclusionItem(croissant, 1);
    expect(state.inclusionItemQuantity(cfSua)).toBe(1);
    expect(state.inclusionItemQuantity(croissant)).toBe(1);
    expect(state.selectedDrinkCount).toBe(1);
    expect(state.selectedPastryCount).toBe(1);
  });

  it('evaluates zero tier discount for non-members and guests', () => {
    const state = new KenBookingState();
    state.set({ spaceId: 'lounge', guests: 6, hours: 1 });
    expect(state.currentTierRate).toBe(0);
    expect(state.tierDiscount).toBe(0);
    expect(state.silverDiscount).toBe(0);
    expect(state.total).toBe(state.subtotal);
  });

  it('computes member tier discount when quote arrives', () => {
    const state = new KenBookingState();
    state.set({ spaceId: 'lounge', guests: 6, hours: 1 });
    state.quoteSignal.set({
      tierCode: 'SILVER',
      tierRate: 0.05,
      pricing: {
        subtotal: 220000,
        tierDiscount: 11000,
        voucherDiscount: 0,
        finalAmount: 209000
      }
    } as any);

    expect(state.currentTierRate).toBe(0.05);
    expect(state.tierDiscount).toBe(11000);
    expect(state.silverDiscount).toBe(11000);
    expect(state.tierDiscountLabel).toBe('Ưu đãi thành viên (5%)');
    expect(state.total).toBe(209000);
  });
});
