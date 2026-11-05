import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, RouterModule } from '@angular/router';

import { CustomerLayout } from './customer-layout';

@NgModule({
  declarations: [CustomerLayout],
  imports: [RouterModule],
  providers: [provideRouter([])],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
class CustomerLayoutTestModule {}

describe('CustomerLayout', () => {
  let component: CustomerLayout;
  let fixture: ComponentFixture<CustomerLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerLayoutTestModule],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomerLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render header, content and footer', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('app-header')).not.toBeNull();
    expect(element.querySelector('router-outlet')).not.toBeNull();
    expect(element.querySelector('app-footer')).not.toBeNull();
  });
});
