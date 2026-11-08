import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OtpInput } from './otp-input';

describe('OtpInput', () => {
  let component: OtpInput;
  let fixture: ComponentFixture<OtpInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OtpInput],
    }).compileComponents();

    fixture = TestBed.createComponent(OtpInput);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
