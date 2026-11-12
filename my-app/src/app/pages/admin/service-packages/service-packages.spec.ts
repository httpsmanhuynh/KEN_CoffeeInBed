import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ServicePackages } from './service-packages';

describe('ServicePackages', () => {
  let component: ServicePackages;
  let fixture: ComponentFixture<ServicePackages>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ServicePackages],
      imports: [FormsModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ServicePackages);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
