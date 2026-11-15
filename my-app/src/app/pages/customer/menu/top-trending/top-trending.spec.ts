import { describe, it, expect, beforeEach } from 'vitest';
import { TopTrending } from './top-trending';

describe('TopTrending', () => {
  let c: TopTrending;
  beforeEach(() => {
    c = new TopTrending();
  });

  it('shows 4 afternoon dishes and 8 trending dishes by default', () => {
    expect(c.afternoonShown.length).toBe(4);
    expect(c.trendingShown.length).toBe(8);
    expect(c.filtering).toBe(false);
  });

  it('has podium top 3 ordered by rank 1, 2, 3', () => {
    expect(c.hasPodium).toBe(true);
    expect(c.podiumTop3.first?.rank).toBe(1);
    expect(c.podiumTop3.second?.rank).toBe(2);
    expect(c.podiumTop3.third?.rank).toBe(3);
    expect(c.podiumTop3.first?.id).toBe('coldbrew');
  });

  it('formats prices like the design', () => {
    expect(c.fmt(55000).replace(/\s/g, '')).toMatch(/^55[.,\u202f]?000đ$/);
  });

  it('search ignores Vietnamese diacritics', () => {
    c.query = 'bac xiu';
    expect(c.afternoonShown.map(d => d.id)).toEqual(['bacxiu']);
    expect(c.trendingShown.length).toBe(0);
  });

  it('filters by category and price, and sorts', () => {
    c.category = 'Cà phê';
    expect(c.afternoonShown.map(d => d.id)).toEqual(['bacxiu']);
    expect(c.trendingShown.every(d => d.category === 'Cà phê')).toBe(true);
    c.reset();
    c.price = 'gt50';
    expect(c.afternoonShown.map(d => d.id)).toEqual(['matcha']);
    c.reset();
    c.sort = 'priceAsc';
    expect(c.afternoonShown[0].id).toBe('croissant');
  });

  it('reports no results and reset() restores everything', () => {
    c.query = 'khong co mon nay';
    expect(c.total).toBe(0);
    c.reset();
    expect(c.total).toBe(12);
  });
});
