import '@angular/compiler';
import { HttpClient } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { KenAvailabilityService, KenAvailabilitySpace } from './availability.service';

describe('KenAvailabilityService', () => {
  const service = new KenAvailabilityService({} as HttpClient);

  it('matches every backend space code to its booking flow space', () => {
    const spaces: KenAvailabilitySpace[] = [
      { space_code: 'FP-01', name: 'Không gian 1', isAvailable: true },
      { space_code: 'WL-01', name: 'Không gian 2', isAvailable: true },
      { space_code: 'SMR-01', name: 'Không gian 3', isAvailable: true },
      { space_code: 'BR-01', name: 'Không gian 4', isAvailable: true },
      { space_code: 'SBP-01', name: 'Không gian 5', isAvailable: true },
      { space_code: 'DBP-01', name: 'Không gian 6', isAvailable: true },
      { space_code: 'PS-01', name: 'Không gian 7', isAvailable: true },
    ];
    const spaceIds = [
      'focus',
      'work',
      'meeting-small',
      'meeting-large',
      'single',
      'double',
      'private',
    ];

    spaceIds.forEach((spaceId, index) => {
      expect(service.forSpace(spaceId, spaces)).toBe(spaces[index]);
    });
  });

  it('recognizes double pods and boardrooms by name when a space code is missing', () => {
    const spaces: KenAvailabilitySpace[] = [
      { name: 'KÉN nghỉ đôi (Double Bed Pod)', isAvailable: true },
      { name: 'Phòng họp lớn (Boardroom)', isAvailable: true },
    ];

    expect(service.forSpace('double', spaces)).toBe(spaces[0]);
    expect(service.forSpace('meeting-large', spaces)).toBe(spaces[1]);
  });
});
