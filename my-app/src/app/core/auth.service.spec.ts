import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService, AuthenticatedUser } from './auth.service';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  const user: AuthenticatedUser = {
    id: 'user-1',
    fullName: 'Nguyễn Thị KÉN',
    phone: '0900000000',
    email: null,
    role: 'CUSTOMER',
    twoFactorEnabled: false,
    membershipTier: 'BASIC',
    tierPoints: 0,
    coinsBalance: 0,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('restores the authenticated user from the session cookie', async () => {
    const result = firstValueFrom(auth.loadSession());
    const request = http.expectOne('/api/auth/me');
    expect(request.request.withCredentials).toBe(true);
    request.flush(user);

    expect(await result).toEqual(user);
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.user?.fullName).toBe(user.fullName);
  });

  it('treats a missing session as a guest', async () => {
    const result = firstValueFrom(auth.ensureSession());
    http.expectOne('/api/auth/me').flush(
      { code: 'UNAUTHENTICATED' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(await result).toBeNull();
    expect(auth.isAuthenticated).toBe(false);
  });

  it('updates the signed-in user and clears it after logout', async () => {
    const login = firstValueFrom(auth.login({ identifier: user.phone, password: 'password' }));
    http.expectOne('/api/auth/login').flush({ user });
    await login;
    expect(auth.user).toEqual(user);

    const logout = firstValueFrom(auth.logout());
    http.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await logout;
    expect(auth.isAuthenticated).toBe(false);
  });
});
