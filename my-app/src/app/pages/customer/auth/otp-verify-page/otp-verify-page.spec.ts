import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { OtpVerifyPage } from './otp-verify-page';
import { AppModule } from '../../../../app-module';
import { AuthService } from '../../../../core/auth.service';

describe('OtpVerifyPage', () => {
  afterEach(() => {
    history.replaceState({}, '');
    try { sessionStorage.removeItem('ken_2fa_identifier'); } catch {}
  });

  async function setup(query: Record<string, string> = {}) {
    const authStub = {
      verifyOtp: vi.fn(() => of({ ok: true })),
      resendOtp: vi.fn(() => of({ ok: true })),
      verifyLogin2FA: vi.fn(() => of({ user: { id: 'u1', role: 'CUSTOMER' } })),
      resendLogin2FAOtp: vi.fn(() => of({ ok: true })),
    };

    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        { provide: AuthService, useValue: authStub },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OtpVerifyPage);
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, authStub, router };
  }

  it('renders registration wording when entered from registration flow', async () => {
    history.replaceState({ email: 'newuser@example.com' }, '');
    const { fixture, component } = await setup();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(component.isLogin2FA).toBe(false);
    expect(text).toContain('Quay lại đăng ký');
    expect(text).toContain('Xác thực & Tạo tài khoản');
    expect(text).toContain('Bằng cách đăng ký');
  });

  it('renders login 2FA wording and calls verifyLogin2FA in login-2fa mode', async () => {
    history.replaceState({ mode: 'login-2fa', identifier: 'manhtk24406h@st.uel.edu.vn', email: 'manhtk24406h@st.uel.edu.vn' }, '');
    const { fixture, component, authStub, router } = await setup({ mode: 'login-2fa' });
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(component.isLogin2FA).toBe(true);
    expect(text).toContain('Quay lại đăng nhập');
    expect(text).toContain('Xác thực & Đăng nhập');
    expect(text).toContain('Bằng cách đăng nhập');

    component.onCodeChange('123456');
    component.verify();
    expect(authStub.verifyLogin2FA).toHaveBeenCalledWith('123456');
    expect(navSpy).toHaveBeenCalledWith('/home-logged-in');
  });
});
