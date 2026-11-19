import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { KenBookingState } from './booking-state';

describe('KenBookingState backend package resolution', () => {
  it('resolves a quote without recursing through package inclusion counts', () => {
    const state = new KenBookingState();
    state.set({ spaceId: 'double', guests: 2, hours: 4 });
    state.rawSpaces = [{ _id: 'space-double', space_code: 'DBP-01' }];
    state.rawPackages = [
      { _id: 'package-double-4h', package_type: 'FIXED', duration_hours: 4, is_active: true },
    ];
    state.rawPricing = [
      { space_id: 'space-double', package_id: 'package-double-4h', price: 310000 },
    ];
    state.rawPackageInclusions = [
      {
        _id: 'drink-inclusion',
        package_id: 'package-double-4h',
        item_type: 'STANDARD_DRINK',
        quantity: 1,
        quantity_basis: 'PER_GUEST',
      },
      {
        _id: 'pastry-inclusion',
        package_id: 'package-double-4h',
        item_type: 'PASTRY',
        quantity: 1,
        quantity_basis: 'PER_GUEST',
      },
    ];
    state.setDrinkQuantity('coffee', 2);
    state.setPastryQuantity('croissant', 2);

    expect(state.requiredDrinkCount).toBe(2);
    expect(state.requiredPastryCount).toBe(2);
    expect(state.selectedDrinks.map(item => item.quantity)).toEqual([2]);
    expect(state.selectedPastries.map(item => item.quantity)).toEqual([2]);
    expect(state.resolveBackendTarget()?.pkg._id).toBe('package-double-4h');
  });
});
