import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PointsTierPage } from './points-tier';

describe('PointsTier', () => {
  let component: PointsTierPage;
  let fixture: ComponentFixture<PointsTierPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PointsTierPage],
    }).compileComponents();

    fixture = TestBed.createComponent(PointsTierPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
