import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { AuthService, AuthenticatedUser } from './core/auth.service';
import { of } from 'rxjs';
import { AppModule } from './app-module';
import { By } from '@angular/platform-browser';
import { Header } from './shared/components/header/header';

describe('App', () => {
  const member: AuthenticatedUser = {
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

  async function configure(authenticatedUser: AuthenticatedUser | null = null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [{
        provide: AuthService,
        useValue: {
          isAuthenticated: authenticatedUser !== null,
          user: authenticatedUser,
          loadSession: () => of(authenticatedUser),
        },
      }],
    }).compileComponents();
  }

  beforeEach(async () => {
    await configure();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders a router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('router-outlet')).toBeTruthy();
  });

  async function headerFor(authenticatedUser: AuthenticatedUser | null): Promise<Header> {
    TestBed.resetTestingModule();
    await configure(authenticatedUser);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return fixture.debugElement.query(By.directive(Header)).componentInstance;
  }

  it('shows the guest header on public pages without a valid session', async () => {
    expect((await headerFor(null)).member).toBe(false);
  });

  it('shows the member header and customer name when a session exists', async () => {
    const header = await headerFor(member);
    expect(header.member).toBe(true);
    expect(header.userName).toBe(member.fullName);
  });
});
