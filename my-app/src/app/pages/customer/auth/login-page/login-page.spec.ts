import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { LoginPage } from './login-page';
import { AppModule } from '../../../../app-module';
import { AuthService } from '../../../../core/auth.service';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;

  async function configure(returnUrl: string | null = null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        { provide: AuthService, useValue: {} },
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
});
