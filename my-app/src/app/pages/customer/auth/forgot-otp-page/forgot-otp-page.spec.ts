import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForgotOtpPage } from './forgot-otp-page';

describe('ForgotOtpPage', () => {
  let component: ForgotOtpPage;
  let fixture: ComponentFixture<ForgotOtpPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ForgotOtpPage],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotOtpPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
