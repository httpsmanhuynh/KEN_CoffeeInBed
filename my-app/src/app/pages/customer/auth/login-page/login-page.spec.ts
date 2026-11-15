import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { LoginPage } from './login-page';
import { AppModule } from '../../../../app-module';
import { AuthService } from '../../../../core/auth.service';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  let authStub: { login: ReturnType<typeof vi.fn> };

  async function configure(returnUrl: string | null = null): Promise<void> {
    authStub = { login: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        { provide: AuthService, useValue: authStub },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) } },
        },
      ],
    }).compileComponents();
  }

  beforeEach(async () => {
    await configure();
    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows that login is required when redirected from a protected action', async () => {
    TestBed.resetTestingModule();
    await configure('/reviews');
    const redirectedFixture = TestBed.createComponent(LoginPage);
    expect(redirectedFixture.componentInstance.requiresLogin).toBe(true);
  });

  it('navigates to /otp-verify with login-2fa mode when login requires 2FA', () => {
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    authStub.login.mockReturnValue(of({ requires2FA: true }));

    component.form.setValue({ identifier: 'manhtk24406h@st.uel.edu.vn', password: '22222222' });
    component.submit();

    expect(navSpy).toHaveBeenCalledWith(['/otp-verify'], expect.objectContaining({
      queryParams: { mode: 'login-2fa' },
      state: expect.objectContaining({
        mode: 'login-2fa',
        identifier: 'manhtk24406h@st.uel.edu.vn',
        email: 'manhtk24406h@st.uel.edu.vn',
      }),
    }));
  });
});
