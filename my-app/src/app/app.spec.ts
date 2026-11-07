import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Location } from '@angular/common';
import { RouterModule } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([])],
      declarations: [App],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
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

  async function headerMemberFor(path: string): Promise<boolean> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([])],
      declarations: [App],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [{ provide: Location, useValue: { path: () => path } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return (fixture.nativeElement.querySelector('app-header') as any).member;
  }

  it('loading a customer page directly shows the logged-in header right away (no guest flash)', async () => {
    expect(await headerMemberFor('/security')).toBe(true);
    expect(await headerMemberFor('/top-trending')).toBe(true);
  });

  it('auth pages show the guest header', async () => {
    expect(await headerMemberFor('/login')).toBe(false);
    expect(await headerMemberFor('/register')).toBe(false);
  });
});
