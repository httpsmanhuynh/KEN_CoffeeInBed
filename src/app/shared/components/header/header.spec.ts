import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, RouterModule } from '@angular/router';
import { HeaderComponent } from './header';

@NgModule({
  declarations: [HeaderComponent],
  imports: [CommonModule, RouterModule],
  providers: [provideRouter([])],
})
class HeaderTestModule {}

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderTestModule],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show login and register for guests', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Đăng nhập');
    expect(element.textContent).toContain('Đăng ký');
  });

  it('should show customer name after login', () => {
    fixture.componentRef.setInput('isLoggedIn', true);
    fixture.componentRef.setInput('userName', 'Khách thử');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.nav-auth .customer-name')?.textContent)
      .toContain('Khách thử');
  });
});

