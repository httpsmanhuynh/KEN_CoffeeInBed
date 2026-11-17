import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';
import { AuthService, AuthenticatedUser } from './auth.service';
import { customerGuard } from './customer.guard';

describe('customerGuard', () => {
  const makeUser = (role: string): AuthenticatedUser => ({
    id: 'u-1',
    fullName: 'Test User',
    phone: '0900000000',
    email: null,
    role,
    twoFactorEnabled: false,
    membershipTier: 'BASIC',
    tierPoints: 0,
    coinsBalance: 0,
  });

  function setup(user: AuthenticatedUser | null) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user, ensureSession: () => of(user) } },
      ],
    });
  }

  function runGuard(): Promise<boolean | UrlTree> {
    const result = TestBed.runInInjectionContext(() =>
      customerGuard({} as ActivatedRouteSnapshot, { url: '/home-logged-in' } as RouterStateSnapshot),
    );
    return firstValueFrom(result as Observable<boolean | UrlTree>);
  }

  it('redirects ADMIN to /admin/dashboard', async () => {
    setup(makeUser('ADMIN'));
    const router = TestBed.inject(Router);
    const res = await runGuard();
    expect(res instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(res as UrlTree)).toBe('/admin/dashboard');
  });

  it('allows CUSTOMER', async () => {
    setup(makeUser('CUSTOMER'));
    const res = await runGuard();
    expect(res).toBe(true);
  });

  it('allows guest (null)', async () => {
    setup(null);
    const res = await runGuard();
    expect(res).toBe(true);
  });
});
