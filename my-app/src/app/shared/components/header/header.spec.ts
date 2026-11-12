import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Header } from './header';
import { MAIN_NAV } from '../../../core/nav-links';
import { AuthService } from '../../../core/auth.service';
import { of } from 'rxjs';
import { AppModule } from '../../../app-module';
import { SuggestionPopupService } from '../../services/suggestion-popup.service';

describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  let component: Header;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [{ provide: AuthService, useValue: { logout: () => of(undefined) } }],
    }).compileComponents();
    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
  });

  it('should create', () => expect(component).toBeTruthy());

  it('guest header shows Đăng nhập / Đăng ký and no account menu', () => {
    fixture.detectChanges();
    expect(el().querySelector('.actions')).toBeTruthy();
    expect(el().querySelector('.account')).toBeNull();
  });

  it('member header shows the account (avatar + name) instead of the guest buttons', () => {
    fixture.componentRef.setInput('member', true);
    fixture.componentRef.setInput('userName', 'Nguyễn Thị KÉN');
    fixture.detectChanges();
    expect(el().querySelector('.actions')).toBeNull();
    expect(el().querySelector('.account__avatar')).toBeTruthy();
    expect(el().querySelector('.account__name')?.textContent).toContain('Nguyễn Thị KÉN');
  });

  it('account dropdown toggles and offers logout', () => {
    fixture.componentRef.setInput('member', true);
    fixture.detectChanges();
    (el().querySelector('.account__toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    const items = Array.from(el().querySelectorAll('.sub--account li')).map(item => item.textContent?.trim());
    expect(items).toEqual(['Tài khoản', 'Lịch sử đặt chỗ', 'Đăng xuất']);
    expect(el().querySelector('.sub--account button')).toBeTruthy();
  });

  it('uses the ▾ character for the three dropdown items, like the design', () => {
    fixture.detectChanges();
    const carets = Array.from(el().querySelectorAll('.caret')).map(c => c.textContent);
    expect(carets).toEqual(['▾', '▾', '▾']);
    expect(MAIN_NAV.filter(i => i.children).length).toBe(3);
  });

  it('highlights Menu and Top Trending as separate header links', async () => {
    const menu = MAIN_NAV.find(i => i.label === 'Menu')!;
    const trending = MAIN_NAV.find(i => i.label === 'Top Trending')!;
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/menu');
    expect(component.isActive(menu)).toBe(true);
    expect(component.isActive(trending)).toBe(false);
    await router.navigateByUrl('/top-trending?x=1');
    expect(component.isActive(menu)).toBe(false);
    expect(component.isActive(trending)).toBe(true);
    await router.navigateByUrl('/security');
    expect(component.isActive(trending)).toBe(false);
    expect(component.isActive(menu)).toBe(false);
  });

  it('includes Top Trending as a direct header link', () => {
    fixture.detectChanges();
    const link = Array.from(el().querySelectorAll<HTMLAnchorElement>('.nav__link'))
      .find(anchor => anchor.textContent?.trim() === 'Top Trending');

    expect(link?.getAttribute('href')).toBe('/top-trending');
  });

  it('does not open the trending suggestion when Menu is clicked', () => {
    const popup = TestBed.inject(SuggestionPopupService);
    const menu = MAIN_NAV.find(item => item.label === 'Menu')!;

    component.onNavClick(menu);

    expect(popup.isOpen()).toBe(false);
  });
});
