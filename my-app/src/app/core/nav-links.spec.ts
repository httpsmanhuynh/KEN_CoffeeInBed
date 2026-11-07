import { isGuestPath } from './nav-links';

describe('isGuestPath', () => {
  it('auth pages use the guest header', () => {
    for (const u of ['/', '/register', '/login', '/otp-verify', '/forgot-password', '/forgot-otp', '/reset-password']) {
      expect(isGuestPath(u)).toBe(true);
    }
  });

  it('tolerates query, hash, trailing slash and sub-routes of auth pages', () => {
    expect(isGuestPath('/login?next=/menu')).toBe(true);
    expect(isGuestPath('/register/')).toBe(true);
    expect(isGuestPath('/forgot-password/otp')).toBe(true);
    expect(isGuestPath('/Login#top')).toBe(true);
  });

  it('every other customer page uses the logged-in header', () => {
    for (const u of [
      '/booking-list', '/booking-reschedule', '/booking-cancel?code=KEN-241026-006',
      '/user-profile', '/security', '/security/', '/points-tier', '/coins-rewards',
      '/menu', '/menu?popup=1', '/top-trending', '/some-new-page',
    ]) {
      expect(isGuestPath(u)).toBe(false);
    }
  });

  it('does not confuse routes that merely start with an auth word', () => {
    expect(isGuestPath('/login-history')).toBe(false);
    expect(isGuestPath('/registered-guests')).toBe(false);
  });
});
