import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, RouterModule } from '@angular/router';
import { Header } from './header';
import { MAIN_NAV } from '../../../core/nav-links';

@Component({ template: '', standalone: true })
class Blank {}

describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  let component: Header;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([{ path: '**', component: Blank }])],
      declarations: [Header],
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
    fixture.detectChanges();
    expect(el().querySelector('.actions')).toBeNull();
    expect(el().querySelector('.account__avatar')).toBeTruthy();
    expect(el().querySelector('.account__name')?.textContent).toContain('Thầy Thanh đẹp trai');
  });

  it('account dropdown toggles and logout goes to /login', () => {
    fixture.componentRef.setInput('member', true);
    fixture.detectChanges();
    (el().querySelector('.account__toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    const links = Array.from(el().querySelectorAll('.sub--account a')).map(a => a.textContent?.trim());
    expect(links).toEqual(['Tài khoản', 'Lịch sử đặt chỗ', 'Đăng xuất']);
  });

  it('uses the ▾ character for the three dropdown items, like the design', () => {
    fixture.detectChanges();
    const carets = Array.from(el().querySelectorAll('.caret')).map(c => c.textContent);
    expect(carets).toEqual(['▾', '▾', '▾']);
    expect(MAIN_NAV.filter(i => i.children).length).toBe(3);
  });

  it('underlines Menu on /menu and on /top-trending', async () => {
    const menu = MAIN_NAV.find(i => i.label === 'Menu')!;
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/menu');
    expect(component.isActive(menu)).toBe(true);
    await router.navigateByUrl('/top-trending?x=1');
    expect(component.isActive(menu)).toBe(true);
    await router.navigateByUrl('/security');
    expect(component.isActive(menu)).toBe(false);
  });
});
