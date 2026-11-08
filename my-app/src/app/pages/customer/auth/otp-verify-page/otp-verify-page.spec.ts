import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OtpVerifyPage } from './otp-verify-page';

describe('OtpVerifyPage', () => {
  let component: OtpVerifyPage;
  let fixture: ComponentFixture<OtpVerifyPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OtpVerifyPage],
    }).compileComponents();

    fixture = TestBed.createComponent(OtpVerifyPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
